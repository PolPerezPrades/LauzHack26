"""Shared frame container, MediaPipe task creation and drawing helpers."""
import sys
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions


def create_task(task_cls, options_cls, model_path, gpu=True, **options):
    """Create a MediaPipe vision task on the GPU (OpenGL) delegate, falling back to CPU."""
    for delegate in ([BaseOptions.Delegate.GPU] if gpu else []) + [BaseOptions.Delegate.CPU]:
        try:
            base = BaseOptions(model_asset_path=model_path, delegate=delegate)
            return task_cls.create_from_options(options_cls(base_options=base, **options))
        except Exception as e:  # noqa: BLE001 - any delegate failure -> try the next one
            if delegate == BaseOptions.Delegate.CPU:
                raise
            print(f"[{task_cls.__name__}] GPU delegate unavailable ({e}); using CPU", file=sys.stderr)


@dataclass
class Frame:
    """One camera frame prepared for inference.

    All module results use coordinates normalized to [0, 1] relative to this frame,
    so they can be drawn on (or mapped to) an image of any size.
    """
    bgr: np.ndarray          # inference image (possibly downscaled from capture), BGR
    rgb: np.ndarray
    mp_image: mp.Image
    ts_ms: int               # monotonically increasing timestamp
    mirrored: bool           # True if the image was flipped horizontally (selfie view)

    @classmethod
    def from_bgr(cls, bgr, ts_ms, mirrored):
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        return cls(bgr, rgb, mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts_ms, mirrored)

    @property
    def size(self):
        h, w = self.bgr.shape[:2]
        return w, h


def to_px(norm_xy, img):
    """(N, >=2) normalized coords -> (N, 2) int pixel coords for img."""
    h, w = img.shape[:2]
    return (np.asarray(norm_xy)[:, :2] * (w, h)).round().astype(int)


def thickness(img, base=2):
    return max(1, round(base * img.shape[1] / 1280))


def label(img, text, org, color=(255, 255, 255), bg=(0, 0, 0), scale=0.6, anchor="bl"):
    """Draw text with a filled background box. anchor 'bl' = org is bottom-left, 'tl' = top-left."""
    s = scale * img.shape[1] / 1280
    th = thickness(img, 1)
    (tw, tht), base = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, s, th)
    x, y = int(org[0]), int(org[1])
    if anchor == "tl":
        y += tht + base
    x = min(max(x, 0), img.shape[1] - tw - 4)
    y = min(max(y, tht + base + 2), img.shape[0] - 2)
    cv2.rectangle(img, (x - 2, y - tht - base - 2), (x + tw + 2, y + 2), bg, -1)
    cv2.putText(img, text, (x, y - base // 2), cv2.FONT_HERSHEY_SIMPLEX, s, color, th, cv2.LINE_AA)
    return tht + base + 6


def draw_connections(img, pts, connections, color, mask=None, th=None):
    th = th or thickness(img)
    for c in connections:
        a, b = (c.start, c.end) if hasattr(c, "start") else c
        if mask is not None and not (mask[a] and mask[b]):
            continue
        cv2.line(img, tuple(pts[a]), tuple(pts[b]), color, th, cv2.LINE_AA)
