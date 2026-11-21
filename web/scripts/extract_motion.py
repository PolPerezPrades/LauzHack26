"""Offline motion extraction from REAL sign videos with MediaPipe Holistic.

Outputs (consumed by the web SignViewer, see src/viewer/):
  words   -> web/public/motion/<sign-id>.json   upper-body pose + both hands + brows, per frame,
             plus a "crop" box (signing space) used to frame the original video consistently;
             also updates content/signs/<id>.json (avatar if the hands were tracked well, else video).
  letters -> web/content/reference/letter-poses.json   one stable hand pose per letter, taken
             from real fingerspelling clips (WLASL / asldeafined), used to verify the 3D letters.
             The clips are also saved to web/public/media/letters-video/ for the "real video" toggle.

Nothing here generates signs: every frame comes from a real signer. Run from the repo root:
    uv run python web/scripts/extract_motion.py words      # all word / number clips
    uv run python web/scripts/extract_motion.py letters
"""
import json
import sys
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

WEB = Path(__file__).resolve().parent.parent
ROOT = WEB.parent
MODEL = ROOT / "models" / "holistic_landmarker.task"
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/holistic_landmarker/"
             "holistic_landmarker/float16/latest/holistic_landmarker.task")
UA = "asl-learning-prototype/0.1 (educational hackathon project)"
TARGET_FPS = 15
# pose joints kept for the avatar: nose, eyes(outer), ears, mouth corners, shoulders, elbows, wrists, hips
POSE_IDX = [0, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24]
BROW_KEYS = ("browInnerUp", "browDownLeft", "browDownRight", "browOuterUpLeft", "browOuterUpRight", "jawOpen",
             "mouthSmileLeft", "mouthSmileRight")


def download(url, path):
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[download] {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        path.write_bytes(r.read())
    return path


def landmarker():
    download(MODEL_URL, MODEL)
    opts = vision.HolisticLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.4,
        min_hand_landmarks_confidence=0.4,
        output_face_blendshapes=True,
    )
    return vision.HolisticLandmarker.create_from_options(opts)


def arr(lms):
    return np.array([[p.x, p.y, p.z] for p in lms], np.float32) if lms else None


def run_video(path):
    """-> list of per-frame dicts (sampled at ~TARGET_FPS) and the source fps."""
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, round(fps / TARGET_FPS))
    frames, i = [], 0
    with landmarker() as lm:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if i % step == 0:
                img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                r = lm.detect_for_video(img, int(i * 1000 / fps))
                bs = {c.category_name: c.score for c in r.face_blendshapes} if r.face_blendshapes else {}
                frames.append(dict(
                    pose=arr(r.pose_world_landmarks), pose_img=arr(r.pose_landmarks),
                    lh=arr(r.left_hand_world_landmarks), rh=arr(r.right_hand_world_landmarks),
                    lh_img=arr(r.left_hand_landmarks), rh_img=arr(r.right_hand_landmarks),
                    face=[bs.get(k, 0.0) for k in BROW_KEYS] if bs else None,
                ))
            i += 1
    cap.release()
    return frames, fps / step


def fill(seq, max_gap=6):
    """Linear-interpolate short gaps (None) in a list of arrays; long gaps stay None."""
    out = list(seq)
    idx = [i for i, v in enumerate(out) if v is not None]
    for a, b in zip(idx, idx[1:]):
        if 1 < b - a <= max_gap + 1:
            for k in range(a + 1, b):
                t = (k - a) / (b - a)
                out[k] = out[a] * (1 - t) + out[b] * t
    return out


def smooth(seq, w=(0.25, 0.5, 0.25)):
    out = list(seq)
    for i in range(1, len(seq) - 1):
        if all(seq[j] is not None for j in (i - 1, i, i + 1)):
            out[i] = w[0] * seq[i - 1] + w[1] * seq[i] + w[2] * seq[i + 1]
    return out


def r3(a):
    return None if a is None else np.round(a, 4).reshape(-1).tolist()


# ---------------------------------------------------------------------------------------------
def extract_word(sign_id, video, source):
    frames, fps = run_video(video)
    if not frames or sum(f["pose"] is not None for f in frames) < len(frames) * 0.6:
        return None
    pose = fill([f["pose"] for f in frames], 10)
    # active span: a wrist clearly above the rest position (MediaPipe world y points down)
    def active(p):
        if p is None:
            return False
        sh_y, hip_y = (p[11, 1] + p[12, 1]) / 2, (p[23, 1] + p[24, 1]) / 2
        thr = hip_y + 0.35 * (sh_y - hip_y)
        return min(p[15, 1], p[16, 1]) < thr
    act = [i for i, p in enumerate(pose) if active(p)]
    if not act:
        return None
    a, b = max(0, act[0] - 3), min(len(frames), act[-1] + 4)
    frames, pose = frames[a:b], pose[a:b]

    lh = smooth(fill([f["lh"] for f in frames]))
    rh = smooth(fill([f["rh"] for f in frames]))
    pose = smooth(pose)
    face = fill([np.array(f["face"], np.float32) if f["face"] else None for f in frames])

    # crop box (normalized image coords) covering head, elbows and hands over the whole sign
    pts = []
    for f in frames:
        if f["pose_img"] is not None:
            pts.append(f["pose_img"][[0, 7, 8, 11, 12, 13, 14, 15, 16], :2])
        for k in ("lh_img", "rh_img"):
            if f[k] is not None:
                pts.append(f[k][:, :2])
    pts = np.concatenate(pts)
    x0, y0 = np.percentile(pts, 1, axis=0)
    x1, y1 = np.percentile(pts, 99, axis=0)
    pad = 0.08
    crop = [float(np.clip(x0 - pad, 0, 1)), float(np.clip(y0 - pad * 1.6, 0, 1)),
            float(np.clip(x1 + pad, 0, 1)), float(np.clip(y1 + pad, 0, 1))]

    n = len(frames)
    cov = lambda s: round(sum(x is not None for x in s) / n, 3)
    return {
        "id": sign_id,
        "fps": round(fps, 2),
        "frames": n,
        "poseJoints": POSE_IDX,
        "pose": [r3(p[POSE_IDX]) if p is not None else None for p in pose],
        "leftHand": [r3(h) for h in lh],
        "rightHand": [r3(h) for h in rh],
        "face": {"keys": list(BROW_KEYS), "values": [r3(v) for v in face]},
        "crop": [round(c, 4) for c in crop],
        "quality": {"leftHand": cov(lh), "rightHand": cov(rh), "pose": cov(pose)},
        "source": source,
        "extractor": "MediaPipe Holistic (mediapipe 1.2.0), offline",
    }


def words():
    """Extract motion for every word/number clip and update its sign JSON (render + crop + review)."""
    out_dir = WEB / "public" / "motion"
    out_dir.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    for path in sorted((WEB / "content" / "signs").glob("*.json")):
        spec = json.loads(path.read_text("utf8"))
        if spec["type"] == "letter" or not spec.get("video") or (only and spec["id"] not in only):
            continue
        video = WEB / "public" / spec["video"]["src"].lstrip("/")
        if not video.exists():
            print(f"[word] {spec['id']:16s} !! video missing (run npm run setup:media)")
            continue
        res = extract_word(spec["id"], video, spec["video"]["source"])
        if res is None:
            print(f"[word] {spec['id']:16s} !! no usable motion")
            continue
        (out_dir / f"{spec['id']}.json").write_text(json.dumps(res, separators=(",", ":")), "utf8")
        q = res["quality"]
        dom, sec = max(q["leftHand"], q["rightHand"]), min(q["leftHand"], q["rightHand"])
        # avatar only when the hands were tracked well enough; otherwise keep the framed real video
        good = spec["type"] == "word" and dom >= 0.8 and (sec < 0.1 or sec >= 0.7)
        spec["render"] = {"type": "avatar", "motion": f"/motion/{spec['id']}.json"} if good else {"type": "video"}
        spec["video"]["crop"] = res["crop"]
        spec["review"] = {
            "status": "auto-checked" if good else "source-video",
            "note": (f"Movimiento extraído del vídeo real (cobertura manos: {q['leftHand']}/{q['rightHand']})."
                     if good else "Se muestra el vídeo original encuadrado."),
        }
        path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", "utf8")
        print(f"[word] {spec['id']:16s} frames={res['frames']:3d} hands L={q['leftHand']:.2f} R={q['rightHand']:.2f} -> {spec['render']['type']}")


# ---------------------------------------------------------------------------------------------
def letters():
    cache = json.loads((WEB / ".cache" / "WLASL_v0.3.json").read_text("utf8"))
    by = {e["gloss"]: e["instances"] for e in cache}
    vid_dir = WEB / "public" / "media" / "letters-video"
    out = {}
    for L in "abcdefghijklmnopqrstuvwxyz":
        inst = [i for i in by.get(L, []) if i["source"] == "asldeafined" and i["frame_end"] == -1]
        if not inst:
            print(f"[letter] {L.upper()} -- no real clip available")
            continue
        url = inst[0]["url"]
        try:
            video = download(url, vid_dir / f"{L.upper()}.mp4")
        except Exception as e:  # noqa: BLE001
            print(f"[letter] {L.upper()} !! download failed: {e}")
            continue
        frames, fps = run_video(video)
        best, best_score = None, 1e9
        for side in ("rh", "lh"):
            seq = [f[side] for f in frames]
            imgs = [f[side + "_img"] for f in frames]
            for i in range(1, len(seq) - 1):
                if seq[i] is None or seq[i - 1] is None or seq[i + 1] is None:
                    continue
                motion = float(np.abs(seq[i + 1] - seq[i - 1]).sum())
                height = float(imgs[i][0, 1])  # lower wrist y in image = hand raised higher
                score = motion + 0.5 * height
                if score < best_score:
                    best_score, best = score, (side, seq[i], imgs[i], i)
        if best is None:
            print(f"[letter] {L.upper()} !! hand not detected")
            continue
        side, world, img, i = best
        out[L.upper()] = {
            "hand": "right" if side == "rh" else "left",
            "world": r3(world), "image": r3(img), "frame": i,
            "video": f"/media/letters-video/{L.upper()}.mp4",
            "source": {"dataset": "WLASL v0.3", "site": "asldeafined", "url": url},
        }
        print(f"[letter] {L.upper()} ok ({out[L.upper()]['hand']} hand, frame {i})")
    path = WEB / "content" / "reference" / "letter-poses.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=1), "utf8")
    print(f"-> {path} ({len(out)} letters)")


if __name__ == "__main__":
    {"words": words, "letters": letters}[sys.argv[1] if len(sys.argv) > 1 else "words"]()
