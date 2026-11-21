"""Threaded capture for the Logitech MX Brio (works with any UVC webcam).

Linux uses V4L2 (device found via /dev/v4l/by-id); Windows uses DirectShow (device found by name).
A background thread keeps grabbing frames so read() always returns the newest one
(no stale buffered frames -> low latency even when inference is slower than the camera).
"""
import glob
import sys
import threading
import time

import cv2

RESOLUTIONS = {"720p": (1280, 720), "1080p": (1920, 1080), "1440p": (2560, 1440), "4k": (3840, 2160)}
WINDOWS = sys.platform == "win32"
# DirectShow honours MJPG + resolution reliably; MSMF is slow to open and may ignore the FOURCC.
BACKEND = cv2.CAP_DSHOW if WINDOWS else cv2.CAP_V4L2


def list_cameras():
    """[(index, name)] of the cameras OpenCV can open with BACKEND (names only available on Windows)."""
    if WINDOWS:
        from cv2_enumerate_cameras import enumerate_cameras
        return [(c.index, c.name) for c in enumerate_cameras(BACKEND)]
    return [(d, d) for d in sorted(glob.glob("/dev/v4l/by-id/*-video-index0"))]


def find_mx_brio():
    if WINDOWS:
        return next((i for i, name in list_cameras() if "mx brio" in name.lower()), None)
    devs = sorted(glob.glob("/dev/v4l/by-id/usb-046d_MX_Brio_*-video-index0"))
    return devs[0] if devs else None


class Camera:
    def __init__(self, device=None, resolution="1080p", fps=30, reset_zoom=True):
        if device is None:
            device = find_mx_brio()
            if device is None:
                print("[camera] MX Brio not found, using the default camera (index 0)", file=sys.stderr)
                device = 0
        if isinstance(device, str) and device.isdigit():
            device = int(device)
        self.cap = cv2.VideoCapture(device, BACKEND)
        if not self.cap.isOpened():
            raise RuntimeError(f"cannot open camera {device}")
        w, h = RESOLUTIONS[resolution]
        # MJPEG is required for >720p at full frame rate over USB.
        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, w)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if reset_zoom:  # the Brio remembers digital zoom/pan/tilt; force the full field of view
            self.cap.set(cv2.CAP_PROP_ZOOM, 100)
            self.cap.set(cv2.CAP_PROP_PAN, 0)
            self.cap.set(cv2.CAP_PROP_TILT, 0)
        self.device = device
        self.size = (int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))

        self._cond = threading.Condition()
        self._frame, self._ts, self._seq, self._last_seq = None, 0, 0, 0
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def settings_dialog(self):
        """Windows only: open the DirectShow camera properties dialog (zoom, focus, exposure...)."""
        return self.cap.set(cv2.CAP_PROP_SETTINGS, 1)

    def _loop(self):
        while self._running:
            ok, frame = self.cap.read()
            if not ok:
                time.sleep(0.01)
                continue
            with self._cond:
                # perf_counter: monotonic with sub-ms resolution (time.monotonic is ~15 ms on Windows)
                self._frame, self._ts = frame, time.perf_counter()
                self._seq += 1
                self._cond.notify_all()

    def read(self, timeout=2.0):
        """Block until a frame newer than the last one returned is available -> (bgr, t_seconds)."""
        with self._cond:
            if not self._cond.wait_for(lambda: self._seq > self._last_seq, timeout):
                raise RuntimeError("camera timed out")
            self._last_seq = self._seq
            return self._frame, self._ts

    def close(self):
        self._running = False
        self._thread.join(timeout=1)
        self.cap.release()
