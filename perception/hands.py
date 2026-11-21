"""Hands: 21 landmarks per hand, handedness, canned gesture, and which fingers are extended.

MediaPipe Gesture Recognizer canned gestures: None, Closed_Fist, Open_Palm, Pointing_Up,
Thumb_Down, Thumb_Up, Victory, ILoveYou.
"""
from dataclasses import dataclass, field

import cv2
import numpy as np
from mediapipe.tasks.python import vision

from . import models
from .common import create_task, draw_connections, label, thickness, to_px

FINGERS = ("thumb", "index", "middle", "ring", "pinky")
# landmark chains (MCP/CMC .. tip) per finger
_CHAINS = {"thumb": (1, 2, 3, 4), "index": (5, 6, 7, 8), "middle": (9, 10, 11, 12),
           "ring": (13, 14, 15, 16), "pinky": (17, 18, 19, 20)}
_COLORS = {"thumb": (80, 80, 255), "index": (80, 220, 80), "middle": (255, 200, 60),
           "ring": (255, 80, 200), "pinky": (60, 220, 255)}
FINGERTIPS = (4, 8, 12, 16, 20)


@dataclass
class Hand:
    handedness: str                # "Left" / "Right" (the person's own hand)
    handedness_score: float
    gesture: str                   # canned gesture name, "None" if no gesture
    gesture_score: float
    landmarks: np.ndarray          # (21, 3) normalized x, y in [0,1]; z relative depth
    world_landmarks: np.ndarray    # (21, 3) metres, origin at hand centre
    fingers_up: dict = field(default_factory=dict)  # {"thumb": bool, ...}

    @property
    def n_fingers(self):
        return sum(self.fingers_up.values())


def _bend(w, chain):
    """Total bend angle (deg) along a finger chain; ~0 when straight."""
    total = 0.0
    for a, b, c in zip(chain, chain[1:], chain[2:]):
        v1, v2 = w[b] - w[a], w[c] - w[b]
        cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
        total += np.degrees(np.arccos(np.clip(cos, -1, 1)))
    return total


def fingers_extended(w):
    """Heuristic finger state from metric world landmarks."""
    up = {}
    for name in FINGERS[1:]:
        mcp, pip, dip, tip = _CHAINS[name]
        up[name] = _bend(w, (0, mcp, pip, dip, tip)) < 80 and \
            np.linalg.norm(w[tip] - w[0]) > np.linalg.norm(w[pip] - w[0])
    # thumb: straight-ish and tip away from the palm (index/middle MCPs)
    palm = (w[5] + w[9]) / 2
    up["thumb"] = _bend(w, (1, 2, 3, 4)) < 50 and \
        np.linalg.norm(w[4] - palm) > 1.2 * np.linalg.norm(w[3] - palm)
    return {k: bool(up[k]) for k in FINGERS}


class HandsModule:
    name = "hands"

    def __init__(self, max_hands=2, gpu=True):
        self.task = create_task(
            vision.GestureRecognizer, vision.GestureRecognizerOptions, models.get("gesture_recognizer"), gpu,
            running_mode=vision.RunningMode.VIDEO,
            num_hands=max_hands,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def process(self, frame):
        r = self.task.recognize_for_video(frame.mp_image, frame.ts_ms)
        hands = []
        for i, lms in enumerate(r.hand_landmarks):
            hd = r.handedness[i][0]
            side = hd.category_name
            if not frame.mirrored:  # MediaPipe assumes a mirrored (selfie) image
                side = {"Left": "Right", "Right": "Left"}.get(side, side)
            g = r.gestures[i][0] if r.gestures and r.gestures[i] else None
            world = np.array([[p.x, p.y, p.z] for p in r.hand_world_landmarks[i]], np.float32)
            hands.append(Hand(
                handedness=side, handedness_score=hd.score,
                gesture=g.category_name if g else "None", gesture_score=g.score if g else 0.0,
                landmarks=np.array([[p.x, p.y, p.z] for p in lms], np.float32),
                world_landmarks=world, fingers_up=fingers_extended(world),
            ))
        return hands

    def draw(self, img, hands):
        th = thickness(img)
        for h in hands:
            pts = to_px(h.landmarks, img)
            draw_connections(img, pts, vision.HandLandmarksConnections.HAND_PALM_CONNECTIONS, (230, 230, 230), th=th)
            for name, chain in _CHAINS.items():
                col = _COLORS[name]
                draw_connections(img, pts, zip(chain, chain[1:]), col, th=th + 1)
                for j in chain[:-1]:
                    cv2.circle(img, tuple(pts[j]), th + 2, col, -1, cv2.LINE_AA)
                tip = tuple(pts[chain[-1]])
                cv2.circle(img, tip, th * 4, col, -1 if h.fingers_up.get(name) else th, cv2.LINE_AA)
            cv2.circle(img, tuple(pts[0]), th + 3, (230, 230, 230), -1, cv2.LINE_AA)

            txt = f"{h.handedness} hand | {h.n_fingers} up"
            if h.gesture != "None":
                txt += f" | {h.gesture} {h.gesture_score:.0%}"
            x0, y0 = pts.min(axis=0)
            label(img, txt, (x0, y0 - 2 * th), color=(255, 255, 255), bg=(90, 60, 20))

    def close(self):
        self.task.close()
