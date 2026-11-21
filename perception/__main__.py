"""Live MX Brio viewer with hands / pose / face / gaze overlays.

    uv run python -m perception                     # all four
    uv run python -m perception hands pose          # only some
    uv run python -m perception face gaze --res 4k

Keys: 1-4 toggle hands/pose/face/gaze, e enroll a face, m mirror, s snapshot, q/Esc quit.
"""
import argparse
import time
from collections import deque
from pathlib import Path

import cv2

from .camera import RESOLUTIONS, Camera
from .common import Frame, label
from .pipeline import DEFAULT_GPU, MODULES, Pipeline

SNAPSHOTS = Path(__file__).resolve().parent.parent / "snapshots"
WINDOW = "MX Brio perception"


def fit_width(img, width):
    h, w = img.shape[:2]
    return img if w <= width else cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("modules", nargs="*", metavar="MODULE",
                   help=f"any of {', '.join(MODULES)} (default: all). Toggle later with keys 1-4.")
    p.add_argument("--device", help="camera path or index (default: MX Brio by id, else 0)")
    p.add_argument("--res", choices=RESOLUTIONS, default="1080p", help="capture resolution (default 1080p)")
    p.add_argument("--infer-width", type=int, default=1920, help="max width of the image fed to the models")
    p.add_argument("--display-width", type=int, default=1920, help="max width of the displayed image")
    p.add_argument("--no-mirror", action="store_true", help="show the raw (non-selfie) image")
    p.add_argument("--no-reset-zoom", action="store_true", help="keep the camera's zoom/pan/tilt")
    p.add_argument("--max-hands", type=int, default=2)
    p.add_argument("--max-poses", type=int, default=1)
    p.add_argument("--max-faces", type=int, default=3)
    p.add_argument("--pose-model", choices=["lite", "full", "heavy"], default="full")
    p.add_argument("--gaze-model", choices=["mobileone_s0", "resnet18"], default="mobileone_s0")
    p.add_argument("--match-threshold", type=float, default=0.363, help="SFace cosine threshold for identity")
    p.add_argument("--cpu", action="store_true", help="run pose on CPU too (default: pose uses the GPU delegate)")
    args = p.parse_args()
    if bad := [m for m in args.modules if m not in MODULES]:
        p.error(f"unknown module(s) {bad}; choose from {MODULES}")
    return args


def main():
    args = parse_args()
    cam = Camera(args.device, args.res, reset_zoom=not args.no_reset_zoom)
    print(f"[camera] {cam.device} @ {cam.size[0]}x{cam.size[1]}")
    pipe = Pipeline(args.modules or MODULES, max_hands=args.max_hands, max_poses=args.max_poses,
                    pose_model=args.pose_model, max_faces=args.max_faces, gaze_model=args.gaze_model,
                    match_threshold=args.match_threshold, gpu=set() if args.cpu else DEFAULT_GPU)
    mirror = not args.no_mirror

    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL | cv2.WINDOW_KEEPRATIO)
    cv2.resizeWindow(WINDOW, 1600, 900)
    frame_times = deque(maxlen=30)
    last_ts = 0
    typing = None            # enrollment name buffer while typing, else None
    msg, msg_until = "", 0.0

    try:
        while True:
            full, t = cam.read()
            if mirror:
                full = cv2.flip(full, 1)
            infer = fit_width(full, args.infer_width)
            last_ts = max(int(t * 1000), last_ts + 1)
            frame = Frame.from_bgr(infer, last_ts, mirror)

            res = pipe.run(frame)

            canvas = fit_width(full, args.display_width)
            canvas = canvas.copy() if canvas is full or canvas is infer else canvas
            pipe.draw(canvas, res)

            # ---- HUD -------------------------------------------------------------------
            frame_times.append(time.perf_counter())
            fps = (len(frame_times) - 1) / (frame_times[-1] - frame_times[0]) if len(frame_times) > 1 else 0
            y = 8
            y += label(canvas, f"{cam.size[0]}x{cam.size[1]}  {fps:4.1f} fps  {'mirror' if mirror else 'raw'}",
                       (8, y), anchor="tl", scale=0.55)
            tm = res.timings_ms
            for i, m in enumerate(MODULES, 1):
                on = m in pipe.enabled
                ms = tm.get(m, 0) + (tm.get("face_mesh", 0) if m == "face" or (m == "gaze" and "face" not in pipe.enabled) else 0)
                y += label(canvas, f"[{i}] {m:<5} {f'{ms:5.1f} ms' if on else '  off'}", (8, y), anchor="tl",
                           scale=0.5, color=(0, 0, 0) if on else (170, 170, 170), bg=(80, 220, 80) if on else (50, 50, 50))
            label(canvas, "1-4 toggle  e enroll face  m mirror  s snapshot  q quit", (8, y), anchor="tl",
                  scale=0.42, bg=(30, 30, 30))
            if typing is not None:
                label(canvas, f"Enroll name: {typing}_   (Enter = save, Esc = cancel)",
                      (20, canvas.shape[0] - 30), scale=0.8, bg=(120, 40, 40))
            elif time.monotonic() < msg_until:
                label(canvas, msg, (20, canvas.shape[0] - 30), scale=0.7, bg=(40, 90, 40))

            cv2.imshow(WINDOW, canvas)
            key = cv2.waitKey(1) & 0xFF
            if cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:
                break
            if key == 255:
                continue

            # ---- keys ------------------------------------------------------------------
            if typing is not None:
                if key == 27:
                    typing = None
                elif key in (13, 10):
                    name = typing.strip().replace("/", "_")
                    typing = None
                    faces = res.faces or []
                    if name and faces:
                        face = max(faces, key=lambda f: f.area())
                        pipe.enable("face")
                        path = pipe.module("face").enroll(frame, face, name)
                        msg = f"enrolled '{name}' -> {path.relative_to(Path.cwd()) if path.is_relative_to(Path.cwd()) else path}"
                    else:
                        msg = "enroll: no face visible" if name else "enroll: empty name"
                    msg_until = time.monotonic() + 3
                elif key in (8, 127):
                    typing = typing[:-1]
                elif 32 <= key < 127:
                    typing += chr(key)
                continue
            if key in (ord("q"), 27):
                break
            if ord("1") <= key <= ord("4"):
                pipe.toggle(MODULES[key - ord("1")])
            elif key == ord("e"):
                if not pipe.enabled & {"face", "gaze"}:
                    pipe.enable("face")
                typing = ""
            elif key == ord("m"):
                mirror = not mirror
            elif key == ord("s"):
                SNAPSHOTS.mkdir(exist_ok=True)
                path = SNAPSHOTS / time.strftime("%Y%m%d-%H%M%S.jpg")
                cv2.imwrite(str(path), canvas)
                msg, msg_until = f"saved {path.name}", time.monotonic() + 2
    finally:
        cam.close()
        pipe.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
