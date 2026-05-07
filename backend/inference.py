"""
Model inference wrapper.
Supports YOLOv8 with stub fallback for testing without a trained model.
Defect labels are derived dynamically from the model's class names.
"""

import numpy as np

# Keywords used to auto-classify a class name as a defect
_DEFECT_KEYWORDS = {"crack", "shelling", "binding", "defect", "damage", "seepage", "fault", "sparking", "wear"}

# Severity tiers keyed by keyword match priority
_SEVERITY_KEYWORDS = {
    "CRITICAL": {"crack", "sparking"},
    "HIGH":     {"shelling", "binding", "damage", "fault"},
    "MEDIUM":   {"seepage", "wear", "defect"},
}


def _classify_severity(label: str) -> str:
    lower = label.lower()
    for severity, keywords in _SEVERITY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return severity
    return "MEDIUM"


def _is_defect(label: str) -> bool:
    lower = label.lower()
    return any(kw in lower for kw in _DEFECT_KEYWORDS)


class InferenceEngine:
    def __init__(self, model_path: str | None = None, use_stub: bool = False):
        self.model = None
        self.model_type = None
        self.use_stub = use_stub
        self.class_names: dict[int, str] = {}   # {class_id: label}
        self.defect_labels: set[str] = set()    # labels classified as defects

        if use_stub:
            print("[InferenceEngine] Running in STUB mode — no model loaded")
            self._init_stub_classes()
            return

        if model_path is None:
            raise ValueError("model_path required when use_stub=False")

        self._load_model(model_path)

    def _init_stub_classes(self):
        self.class_names = {
            0: "Wheel Assembly", 1: "Axle Box Cover", 2: "Brake Pad",
            3: "Coil Spring",    4: "Yaw Damper",     5: "Wheel Shelling",
            6: "Crack Detected", 7: "Brake Binding",  8: "Anti-Roll Bar",
        }
        self.defect_labels = {v for v in self.class_names.values() if _is_defect(v)}

    def _load_model(self, model_path: str):
        try:
            from ultralytics import YOLO
            self.model = YOLO(model_path)
            self.model_type = "yolov8"
            self.class_names = self.model.names  # {int: str}
            self.defect_labels = {label for label in self.class_names.values() if _is_defect(label)}
            print(f"[InferenceEngine] Loaded YOLOv8: {model_path}")
            print(f"[InferenceEngine] Classes  : {list(self.class_names.values())}")
            print(f"[InferenceEngine] Defects  : {self.defect_labels}")
        except ImportError:
            raise RuntimeError("ultralytics not installed. Run: pip install ultralytics")
        except Exception as e:
            raise RuntimeError(f"Failed to load model from {model_path}: {e}")

    def predict(self, frame: np.ndarray) -> list[dict]:
        if self.use_stub:
            return self._stub_detections(frame)
        if self.model_type == "yolov8":
            return self._predict_yolov8(frame)
        return []

    def _predict_yolov8(self, frame: np.ndarray) -> list[dict]:
        results = self.model(frame, verbose=False)[0]
        detections = []
        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = self.class_names[int(box.cls)]
            conf = float(box.conf)
            is_defect = label in self.defect_labels
            detections.append({
                "id": i,
                "label": label,
                "confidence": round(conf, 3),
                "bbox_px": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                "defect": is_defect,
                "track_id": i,
                "severity": _classify_severity(label) if is_defect else None,
            })
        return detections

    def _stub_detections(self, frame: np.ndarray) -> list[dict]:
        import time
        t = int(time.time() * 1.2) % 10
        base = [
            {"id": 0, "label": "Wheel Assembly", "confidence": 0.98, "bbox_px": [80, 200, 200, 220], "defect": False, "track_id": 0, "severity": None},
            {"id": 1, "label": "Axle Box Cover", "confidence": 0.95, "bbox_px": [400, 180, 160, 150], "defect": False, "track_id": 1, "severity": None},
            {"id": 2, "label": "Brake Pad",       "confidence": 0.96, "bbox_px": [240, 280, 130, 110], "defect": False, "track_id": 2, "severity": None},
        ]
        defects = [
            {"id": 3, "label": "Crack Detected",  "confidence": 0.97, "bbox_px": [100, 250, 90, 80],  "defect": True, "track_id": 3, "severity": "CRITICAL"},
            {"id": 4, "label": "Wheel Shelling",  "confidence": 0.91, "bbox_px": [90,  260, 110, 90], "defect": True, "track_id": 4, "severity": "HIGH"},
        ]
        if t in (5, 6, 7):
            return base + defects[:1]
        if t == 8:
            return base[:1] + defects
        return base
