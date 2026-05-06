"""
Model inference wrapper.
Supports YOLOv8 (primary) with a stub fallback for testing without a trained model.
"""

import numpy as np

# Labels that indicate a defect condition
DEFECT_LABELS = {
    "Crack Detected",
    "Wheel Shelling",
    "Brake Binding",
    "Brake Binding – Wheel Sparking",
    "Defect",
    "crack",
}

SEVERITY_MAP = {
    "Crack Detected": "CRITICAL",
    "Wheel Shelling": "HIGH",
    "Brake Binding": "HIGH",
    "Brake Binding – Wheel Sparking": "CRITICAL",
    "Defect": "MEDIUM",
    "crack": "HIGH",
}


class InferenceEngine:
    def __init__(self, model_path: str | None = None, use_stub: bool = False):
        self.model = None
        self.model_type = None
        self.use_stub = use_stub

        if use_stub:
            print("[InferenceEngine] Running in STUB mode — no model loaded")
            return

        if model_path is None:
            raise ValueError("model_path required when use_stub=False")

        self._load_model(model_path)

    def _load_model(self, model_path: str):
        try:
            from ultralytics import YOLO
            self.model = YOLO(model_path)
            self.model_type = "yolov8"
            print(f"[InferenceEngine] Loaded YOLOv8 model: {model_path}")
        except ImportError:
            raise RuntimeError("ultralytics not installed. Run: pip install ultralytics")
        except Exception as e:
            raise RuntimeError(f"Failed to load model from {model_path}: {e}")

    def predict(self, frame: np.ndarray) -> list[dict]:
        """
        Run inference on a single BGR frame (OpenCV format).
        Returns list of detection dicts with bbox in pixel coords.
        """
        if self.use_stub:
            return self._stub_detections(frame)

        if self.model_type == "yolov8":
            return self._predict_yolov8(frame)

        return []

    def _predict_yolov8(self, frame: np.ndarray) -> list[dict]:
        h, w = frame.shape[:2]
        results = self.model(frame, verbose=False)[0]
        detections = []

        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = self.model.names[int(box.cls)]
            conf = float(box.conf)

            detections.append({
                "id": i,
                "label": label,
                "confidence": round(conf, 3),
                "bbox_px": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],  # x,y,w,h pixels
                "defect": label in DEFECT_LABELS,
                "track_id": i,
                "severity": SEVERITY_MAP.get(label, "MEDIUM") if label in DEFECT_LABELS else None,
            })

        return detections

    def _stub_detections(self, frame: np.ndarray) -> list[dict]:
        """Cycles through fake detections for UI testing without a real model."""
        import time
        t = int(time.time() * 1.2) % 10

        base = [
            {"id": 1, "label": "Wheel Assembly",  "confidence": 0.98, "bbox_px": [80, 200, 200, 220], "defect": False, "track_id": 1, "severity": None},
            {"id": 2, "label": "Axle Box Cover",  "confidence": 0.95, "bbox_px": [400, 180, 160, 150], "defect": False, "track_id": 2, "severity": None},
            {"id": 3, "label": "Brake Pad",        "confidence": 0.96, "bbox_px": [240, 280, 130, 110], "defect": False, "track_id": 3, "severity": None},
        ]
        defect = [
            {"id": 4, "label": "Crack Detected",   "confidence": 0.97, "bbox_px": [100, 250, 90, 80],  "defect": True,  "track_id": 4, "severity": "CRITICAL"},
            {"id": 5, "label": "Wheel Shelling",   "confidence": 0.91, "bbox_px": [90,  260, 110, 90], "defect": True,  "track_id": 5, "severity": "HIGH"},
        ]

        if t in (5, 6, 7):
            return base + defect[:1]
        if t == 8:
            return base[:1] + defect
        return base
