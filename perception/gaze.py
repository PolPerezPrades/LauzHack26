"""Gaze: appearance-based gaze direction (MobileGaze, Gaze360-trained, ~12.6 deg mean error)
run on the face crops found by FaceMesh, drawn together with the MediaPipe iris landmarks.

Angles follow the Gaze360 convention in image space: arrow dx = -sin(yaw)cos(pitch),
dy = -sin(pitch) (screen y grows down), so pitch > 0 means looking up.
"""
from dataclasses import dataclass

import cv2
import numpy as np
import onnxruntime as ort

from . import models
from .common import label, thickness, to_px

_IRIS = ((468, (469, 470, 471, 472)), (473, (474, 475, 476, 477)))
_MEAN = np.array([0.485, 0.456, 0.406], np.float32)
_STD = np.array([0.229, 0.224, 0.225], np.float32)


@dataclass
class Gaze:
    yaw: float            # degrees
    pitch: float          # degrees, + = up
    origin: tuple         # normalized (x, y) point between the eyes
    direction: tuple      # unit 2D vector in image space (x right, y down); length shrinks toward camera
    at_camera: bool       # roughly looking into the lens
    description: str      # e.g. "at camera", "left-down" (as seen on screen)
    face_index: int       # index into the FaceMesh face list


class GazeModule:
    name = "gaze"

    def __init__(self, model="mobileone_s0", smoothing=0.5, at_camera_deg=12.0):
        so = ort.SessionOptions()
        so.intra_op_num_threads = 4
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in ort.get_available_providers()]
        self.sess = ort.InferenceSession(models.get(f"gaze_{model}"), so, providers=providers)
        self.input = self.sess.get_inputs()[0].name
        self.bins = np.arange(90, dtype=np.float32)
        self.alpha = smoothing          # EMA weight of the previous estimate (0 = no smoothing)
        self.at_camera_deg = at_camera_deg
        self._prev = {}

    def _infer(self, crop_bgr):
        x = cv2.resize(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB), (448, 448)).astype(np.float32) / 255.0
        x = ((x - _MEAN) / _STD).transpose(2, 0, 1)[None]
        yaw_logits, pitch_logits = self.sess.run(None, {self.input: x})

        def decode(logits):
            p = np.exp(logits - logits.max())
            p /= p.sum()
            return float((p * self.bins).sum() * 4 - 180)  # 90 bins x 4 deg, offset 180

        return decode(yaw_logits[0]), decode(pitch_logits[0])

    def process(self, frame, faces):
        w, h = frame.size
        out = []
        for i, f in enumerate(faces):
            x0, y0, x1, y1 = (np.array(f.bbox) * (w, h, w, h)).astype(int)
            if x1 - x0 < 24 or y1 - y0 < 24:
                continue
            yaw, pitch = self._infer(frame.bgr[y0:y1, x0:x1])
            if i in self._prev and self.alpha:
                py, pp = self._prev[i]
                yaw, pitch = self.alpha * py + (1 - self.alpha) * yaw, self.alpha * pp + (1 - self.alpha) * pitch
            self._prev[i] = (yaw, pitch)

            ry, rp = np.radians(yaw), np.radians(pitch)
            d = (-np.sin(ry) * np.cos(rp), -np.sin(rp))
            origin = tuple(f.landmarks[[468, 473], :2].mean(axis=0))
            at_cam = abs(yaw) < self.at_camera_deg and abs(pitch) < self.at_camera_deg
            if at_cam:
                desc = "at camera"
            else:
                horiz = "left" if d[0] < -0.2 else "right" if d[0] > 0.2 else ""
                vert = "up" if d[1] < -0.2 else "down" if d[1] > 0.2 else ""
                desc = "-".join(s for s in (horiz, vert) if s) or "near camera"
            out.append(Gaze(yaw, pitch, origin, d, at_cam, desc, i))
        for k in [k for k in self._prev if k >= len(faces)]:
            del self._prev[k]
        return out

    def draw(self, img, gazes, faces):
        th = thickness(img)
        for f in faces:  # irises from the face mesh
            pts = to_px(f.landmarks, img)
            for c, ring in _IRIS:
                r = int(np.linalg.norm(pts[list(ring)] - pts[c], axis=1).mean())
                cv2.circle(img, tuple(pts[c]), max(r, 2), (255, 255, 0), th, cv2.LINE_AA)
                cv2.circle(img, tuple(pts[c]), max(th, 2), (0, 0, 255), -1, cv2.LINE_AA)
        h, w = img.shape[:2]
        for g in gazes:
            f = faces[g.face_index]
            o = np.array(g.origin) * (w, h)
            length = 1.8 * (f.bbox[2] - f.bbox[0]) * w
            tip = o + np.array(g.direction) * length
            col = (0, 255, 0) if g.at_camera else (0, 200, 255)
            cv2.arrowedLine(img, tuple(o.astype(int)), tuple(tip.astype(int)), col, th + 1, cv2.LINE_AA, tipLength=0.2)
            x1, y0 = int(f.bbox[2] * w), int(f.bbox[1] * h)
            label(img, f"gaze: {g.description}", (x1 + 6, y0), color=(0, 0, 0), bg=col, scale=0.5, anchor="tl")
            label(img, f"yaw {g.yaw:+.0f}  pitch {g.pitch:+.0f}", (x1 + 6, y0 + 22 * w / 1280),
                  bg=(40, 40, 40), scale=0.45, anchor="tl")
