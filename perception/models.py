"""Model registry: every weight file is open-source and downloaded on first use into ./models."""
import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

_MP = "https://storage.googleapis.com/mediapipe-models"
MODELS = {
    # MediaPipe (Apache-2.0)
    "gesture_recognizer": f"{_MP}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
    "pose_lite": f"{_MP}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "pose_full": f"{_MP}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "pose_heavy": f"{_MP}/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
    "face_landmarker": f"{_MP}/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    # OpenCV Zoo SFace face-recognition embedder (Apache-2.0)
    "sface": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/"
             "face_recognition_sface_2021dec.onnx",
    # MobileGaze, Gaze360-trained gaze estimator (MIT) - github.com/yakhyo/gaze-estimation
    "gaze_mobileone_s0": "https://github.com/yakhyo/gaze-estimation/releases/download/weights/mobileone_s0_gaze.onnx",
    "gaze_resnet18": "https://github.com/yakhyo/gaze-estimation/releases/download/weights/resnet18_gaze.onnx",
}


def get(name: str) -> str:
    """Return the local path of a model, downloading it if needed."""
    url = MODELS[name]
    path = MODELS_DIR / url.rsplit("/", 1)[1]
    if not path.exists():
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        print(f"[models] downloading {name} -> {path.name}", file=sys.stderr)
        req = urllib.request.Request(url, headers={"User-Agent": "lauzhack26-perception"})
        with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        if tmp.stat().st_size < 100_000:  # an HTML error page / LFS pointer, not a model
            tmp.unlink()
            raise RuntimeError(f"download of {name} from {url} looks wrong (too small)")
        tmp.rename(path)
    return str(path)


if __name__ == "__main__":
    for n in sys.argv[1:] or MODELS:
        print(n, get(n))
