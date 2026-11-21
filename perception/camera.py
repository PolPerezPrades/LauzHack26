"""Threaded V4L2 capture for the Logitech MX Brio (works with any UVC webcam).

A background thread keeps grabbing frames so read() always returns the newest one
(no stale buffered frames -> low latency even when inference is slower than the camera).
"""
import glob
import threading
import time

import cv2

RESOLUTIONS = {"720p": (1280, 720), "1080p": (1920, 1080), "1440p": (2560, 1440), "4k": (3840, 2160)}


def find_mx_brio():
    devs = sorted(glob.glob("/dev/v4l/by-id/usb-046d_MX_Brio_*-video-index0"))
    return devs[0] if devs else None


class Camera:
    def __init__(self, device=None, resolution="1080p", fps=30, reset_zoom=True):
        device = device or find_mx_brio() or 0
        if isinstance(device, str) and device.isdigit():
            device = int(device)
        self.cap = cv2.VideoCapture(device, cv2.CAP_V4L2)
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

    def _loop(self):
        while self._running:
            ok, frame = self.cap.read()
            if not ok:
                time.sleep(0.01)
                continue
            with self._cond:
                self._frame, self._ts = frame, time.monotonic()
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
