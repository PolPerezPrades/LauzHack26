"""Faces: MediaPipe Face Landmarker (478-pt mesh incl. irises + 52 expression blendshapes)
shared by the face and gaze modules, plus identity recognition with OpenCV SFace.

Identity gallery: known_faces/<name>/*.png (112x112 aligned crops, written by enroll()).
Press "e" in the viewer to enroll the largest visible face.
"""
import time
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from mediapipe.tasks.python import vision

from . import models
from .common import create_task, draw_connections, label, thickness, to_px

KNOWN_FACES = Path(__file__).resolve().parent.parent / "known_faces"

# mesh indices used to align faces for SFace (eye corners, nose tip, mouth corners)
_EYE_A, _EYE_B, _NOSE, _MOUTH = (33, 133), (362, 263), 1, (61, 291)


@dataclass
class Face:
    landmarks: np.ndarray                 # (478, 3) normalized; 468-472 / 473-477 are the irises
    bbox: tuple                           # normalized (x0, y0, x1, y1)
    expressions: dict = field(default_factory=dict)  # 52 blendshape scores, e.g. {"jawOpen": 0.7}
    identity: str | None = None           # enrolled name, or None if unknown / not computed
    identity_score: float = 0.0           # cosine similarity to best gallery match

    def top_expressions(self, n=3, min_score=0.4):
        items = [(k, v) for k, v in self.expressions.items() if k != "_neutral" and v >= min_score]
        return sorted(items, key=lambda kv: -kv[1])[:n]

    def area(self):
        x0, y0, x1, y1 = self.bbox
        return (x1 - x0) * (y1 - y0)


class FaceMesh:
    """Runs the Face Landmarker once per frame; results are consumed by FaceModule and GazeModule."""
    name = "face_mesh"

    def __init__(self, max_faces=3, gpu=True):
        self.task = create_task(
            vision.FaceLandmarker, vision.FaceLandmarkerOptions, models.get("face_landmarker"), gpu,
            running_mode=vision.RunningMode.VIDEO,
            num_faces=max_faces,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_face_blendshapes=True,
        )

    def process(self, frame):
        r = self.task.detect_for_video(frame.mp_image, frame.ts_ms)
        faces = []
        for i, lms in enumerate(r.face_landmarks):
            pts = np.array([[p.x, p.y, p.z] for p in lms], np.float32)
            x0, y0 = pts[:, :2].min(axis=0).clip(0, 1)
            x1, y1 = pts[:, :2].max(axis=0).clip(0, 1)
            expr = {c.category_name: c.score for c in r.face_blendshapes[i]} if r.face_blendshapes else {}
            faces.append(Face(pts, (float(x0), float(y0), float(x1), float(y1)), expr))
        return faces

    def close(self):
        self.task.close()


def _face_box(face, w, h):
    """Build the 1x15 YuNet-style row that FaceRecognizerSF.alignCrop expects."""
    p = face.landmarks[:, :2] * (w, h)

    def ordered(i, j):  # image-left point first, as in the SFace alignment template
        a, b = p[i], p[j]
        return (a, b) if a[0] <= b[0] else (b, a)

    eye_a = p[list(_EYE_A)].mean(axis=0)
    eye_b = p[list(_EYE_B)].mean(axis=0)
    e1, e2 = (eye_a, eye_b) if eye_a[0] <= eye_b[0] else (eye_b, eye_a)
    m1, m2 = ordered(*_MOUTH)
    x0, y0, x1, y1 = face.bbox
    row = [x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h, *e1, *e2, *p[_NOSE], *m1, *m2, 1.0]
    return np.array([row], np.float32)


class FaceModule:
    """Face mesh drawing + identity (SFace embeddings matched against known_faces/)."""
    name = "face"

    def __init__(self, gallery_dir=KNOWN_FACES, threshold=0.363):
        # 0.363 = OpenCV's recommended cosine threshold for SFace
        self.rec = cv2.FaceRecognizerSF.create(models.get("sface"), "")
        self.gallery_dir = Path(gallery_dir)
        self.threshold = threshold
        self.names, self.feats = [], np.zeros((0, 128), np.float32)
        self._load_gallery()

    def _embed(self, aligned):
        f = self.rec.feature(aligned).reshape(-1).astype(np.float32)
        return f / (np.linalg.norm(f) + 1e-9)

    def _load_gallery(self):
        names, feats = [], []
        for img_path in sorted(self.gallery_dir.glob("*/*.png")):
            img = cv2.imread(str(img_path))
            if img is None or img.shape[:2] != (112, 112):
                print(f"[face] skipping {img_path} (expected a 112x112 aligned crop)")
                continue
            names.append(img_path.parent.name)
            feats.append(self._embed(img))
        self.names = names
        self.feats = np.array(feats, np.float32).reshape(-1, 128)
        if names:
            print(f"[face] gallery: {len(names)} samples of {sorted(set(names))}")

    def align(self, frame, face):
        w, h = frame.size
        return self.rec.alignCrop(frame.bgr, _face_box(face, w, h))

    def process(self, frame, faces):
        if not len(self.names):
            return faces
        for f in faces:
            sims = self.feats @ self._embed(self.align(frame, f))
            best = {}
            for n, s in zip(self.names, sims):
                best[n] = max(best.get(n, -1.0), float(s))
            name, score = max(best.items(), key=lambda kv: kv[1])
            f.identity_score = score
            f.identity = name if score >= self.threshold else None
        return faces

    def enroll(self, frame, face, name):
        """Save an aligned crop of `face` under known_faces/<name>/ and add it to the gallery."""
        d = self.gallery_dir / name
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{int(time.time() * 1000)}.png"
        aligned = self.align(frame, face)
        cv2.imwrite(str(path), aligned)
        self.names.append(name)
        self.feats = np.vstack([self.feats, self._embed(aligned)[None]])
        return path

    def draw(self, img, faces):
        th = thickness(img, 1)
        for f in faces:
            pts = to_px(f.landmarks, img)
            known = f.identity is not None
            col = (80, 220, 80) if known else (200, 200, 200)
            draw_connections(img, pts, vision.FaceLandmarksConnections.FACE_LANDMARKS_CONTOURS, col, th=th)
            x0, y0, x1, y1 = to_px([f.bbox[:2], f.bbox[2:]], img).reshape(-1)
            cv2.rectangle(img, (x0, y0), (x1, y1), col, th, cv2.LINE_AA)
            if not len(self.names):
                name = "face (press e to enroll)"
            elif known:
                name = f"{f.identity} ({f.identity_score:.2f})"
            else:
                name = f"unknown ({f.identity_score:.2f})"
            label(img, name, (x0, y0 - 4), color=(0, 0, 0) if known else (255, 255, 255),
                  bg=col if known else (60, 60, 60))
            exprs = ", ".join(f"{k} {v:.0%}" for k, v in f.top_expressions())
            if exprs:
                label(img, exprs, (x0, y1 + 4), bg=(60, 40, 40), scale=0.45, anchor="tl")
