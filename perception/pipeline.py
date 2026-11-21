"""Runs any subset of {hands, pose, face, gaze} on a Frame, in parallel threads.

hands, pose and the face chain (face mesh -> identity + gaze) run concurrently; MediaPipe and
onnxruntime release the GIL during inference, so this gives real parallelism.
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

MODULES = ("hands", "pose", "face", "gaze")
# Benchmarked on Ryzen 7 4800H + GTX 1650, all 4 modules: pose on GPU = 33 ms/frame, all CPU = 37,
# all GPU = 55 (the GL delegates contend with each other). Only pose gains much from the GPU.
# MediaPipe's Windows wheels are built without GPU support, so don't even try there.
DEFAULT_GPU = set() if sys.platform == "win32" else {"pose"}


@dataclass
class Results:
    hands: list | None = None    # list[hands.Hand]
    bodies: list | None = None   # list[pose.Body]
    faces: list | None = None    # list[face.Face] (also filled when only gaze is enabled)
    gazes: list | None = None    # list[gaze.Gaze]
    timings_ms: dict = field(default_factory=dict)


class Pipeline:
    def __init__(self, enabled=MODULES, *, max_hands=2, max_poses=1, pose_model="full", max_faces=3,
                 gaze_model="mobileone_s0", match_threshold=0.363, gpu=DEFAULT_GPU):
        """gpu: True/False for all MediaPipe modules, or a set of names from {"hands", "pose", "face_mesh"}."""
        gpu = {"hands", "pose", "face_mesh"} if gpu is True else set(gpu or ())
        self.opts = dict(max_hands=max_hands, max_poses=max_poses, pose_model=pose_model, max_faces=max_faces,
                         gaze_model=gaze_model, match_threshold=match_threshold, gpu=gpu)
        self.enabled = set()
        self._mods = {}
        self._pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="perception")
        for m in enabled:
            self.enable(m)

    # -- module management -------------------------------------------------------------
    def module(self, name):
        if name not in self._mods:
            o = self.opts
            if name == "hands":
                from .hands import HandsModule
                self._mods[name] = HandsModule(max_hands=o["max_hands"], gpu="hands" in o["gpu"])
            elif name == "pose":
                from .pose import PoseModule
                self._mods[name] = PoseModule(max_poses=o["max_poses"], model=o["pose_model"], gpu="pose" in o["gpu"])
            elif name == "face_mesh":
                from .face import FaceMesh
                self._mods[name] = FaceMesh(max_faces=o["max_faces"], gpu="face_mesh" in o["gpu"])
            elif name == "face":
                from .face import FaceModule
                self._mods[name] = FaceModule(threshold=o["match_threshold"])
            elif name == "gaze":
                from .gaze import GazeModule
                self._mods[name] = GazeModule(model=o["gaze_model"])
            else:
                raise KeyError(name)
        return self._mods[name]

    def enable(self, name):
        assert name in MODULES, name
        self.module(name)
        if name in ("face", "gaze"):
            self.module("face_mesh")
        self.enabled.add(name)

    def disable(self, name):
        self.enabled.discard(name)

    def toggle(self, name):
        (self.disable if name in self.enabled else self.enable)(name)

    # -- inference -----------------------------------------------------------------------
    @staticmethod
    def _timed(timings, key, fn, *args):
        t0 = time.perf_counter()
        out = fn(*args)
        timings[key] = (time.perf_counter() - t0) * 1000
        return out

    def _face_chain(self, frame, timings):
        faces = self._timed(timings, "face_mesh", self._mods["face_mesh"].process, frame)
        gazes = None
        if "face" in self.enabled:
            self._timed(timings, "face", self._mods["face"].process, frame, faces)
        if "gaze" in self.enabled:
            gazes = self._timed(timings, "gaze", self._mods["gaze"].process, frame, faces)
        return faces, gazes

    def run(self, frame):
        res = Results()
        t = res.timings_ms
        jobs = {}
        if "hands" in self.enabled:
            jobs["hands"] = self._pool.submit(self._timed, t, "hands", self._mods["hands"].process, frame)
        if "pose" in self.enabled:
            jobs["pose"] = self._pool.submit(self._timed, t, "pose", self._mods["pose"].process, frame)
        if self.enabled & {"face", "gaze"}:
            jobs["face"] = self._pool.submit(self._face_chain, frame, t)
        if "hands" in jobs:
            res.hands = jobs["hands"].result()
        if "pose" in jobs:
            res.bodies = jobs["pose"].result()
        if "face" in jobs:
            res.faces, res.gazes = jobs["face"].result()
        return res

    def draw(self, img, res):
        if res.bodies is not None and "pose" in self.enabled:
            self._mods["pose"].draw(img, res.bodies)
        if res.faces is not None and "face" in self.enabled:
            self._mods["face"].draw(img, res.faces)
        if res.gazes is not None and "gaze" in self.enabled:
            self._mods["gaze"].draw(img, res.gazes, res.faces)
        if res.hands is not None and "hands" in self.enabled:
            self._mods["hands"].draw(img, res.hands)

    def close(self):
        self._pool.shutdown(wait=True)
        for m in self._mods.values():
            if hasattr(m, "close"):
                m.close()
