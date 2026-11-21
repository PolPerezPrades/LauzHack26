"""Body pose: 33 landmarks per person (MediaPipe Pose Landmarker, BlazePose GHUM).

Index reference (person's own left/right): 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists,
23/24 hips, 25/26 knees, 27/28 ankles, 31/32 foot tips. Odd = left, even = right (from 11 on).
See vision.PoseLandmark for all names.
"""
from dataclasses import dataclass

import cv2
import numpy as np
from mediapipe.tasks.python import vision

from . import models
from .common import create_task, label, thickness, to_px

# left<->right index permutation, used to keep labels anatomical in a mirrored image
_SWAP = np.array([0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9] +
                 [i + 1 if i % 2 else i - 1 for i in range(11, 33)])
_LEFT = {1, 2, 3, 7, 9} | set(range(11, 33, 2))
_RIGHT = {int(_SWAP[i]) for i in _LEFT}


@dataclass
class Body:
    landmarks: np.ndarray        # (33, 3) normalized x, y in [0,1]; z relative depth
    visibility: np.ndarray       # (33,) 0..1, likelihood the point is visible
    world_landmarks: np.ndarray  # (33, 3) metres, origin between the hips

    def point(self, name):
        """e.g. body.point("LEFT_WRIST") -> normalized (x, y, z)."""
        return self.landmarks[vision.PoseLandmark[name].value]


class PoseModule:
    name = "pose"

    def __init__(self, max_poses=1, model="full", gpu=True):
        self.task = create_task(
            vision.PoseLandmarker, vision.PoseLandmarkerOptions, models.get(f"pose_{model}"), gpu,
            running_mode=vision.RunningMode.VIDEO,
            num_poses=max_poses,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def process(self, frame):
        r = self.task.detect_for_video(frame.mp_image, frame.ts_ms)
        bodies = []
        for i, lms in enumerate(r.pose_landmarks):
            pts = np.array([[p.x, p.y, p.z] for p in lms], np.float32)
            vis = np.array([p.visibility if p.visibility is not None else 1.0 for p in lms], np.float32)
            world = np.array([[p.x, p.y, p.z] for p in r.pose_world_landmarks[i]], np.float32)
            if frame.mirrored:
                pts, vis, world = pts[_SWAP], vis[_SWAP], world[_SWAP]
            bodies.append(Body(pts, vis, world))
        return bodies

    def draw(self, img, bodies, min_vis=0.5):
        th = thickness(img, 3)
        for b in bodies:
            pts = to_px(b.landmarks, img)
            ok = b.visibility >= min_vis
            for c in vision.PoseLandmarksConnections.POSE_LANDMARKS:
                a, e = c.start, c.end
                if not (ok[a] and ok[e]):
                    continue
                col = (0, 165, 255) if a in _LEFT and e in _LEFT else \
                      (255, 200, 0) if a in _RIGHT and e in _RIGHT else (230, 230, 230)
                cv2.line(img, tuple(pts[a]), tuple(pts[e]), col, th, cv2.LINE_AA)
            for j in np.flatnonzero(ok):
                col = (0, 165, 255) if j in _LEFT else (255, 200, 0) if j in _RIGHT else (230, 230, 230)
                cv2.circle(img, tuple(pts[j]), th + 2, col, -1, cv2.LINE_AA)
                cv2.circle(img, tuple(pts[j]), th + 2, (40, 40, 40), 1, cv2.LINE_AA)
            if ok[11] and ok[12]:
                mid = (pts[11] + pts[12]) // 2
                label(img, "body  (orange=left, cyan=right)", (mid[0] - 60, mid[1] - 4 * th),
                      bg=(40, 40, 40), scale=0.45)

    def close(self):
        self.task.close()
