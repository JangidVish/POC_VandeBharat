"""
Model inference wrapper — calls the YOLO microservice (port 5002).
Falls back to stub mode for UI testing when the service is unavailable.
"""

import io
import time

import cv2
import numpy as np
import requests

YOLO_SERVICE_URL = "http://127.0.0.1:5002/api/yolo/predict"
YOLO_TIMEOUT_S = 2.0

class InferenceEngine:
    def __init__(self, use_stub: bool = False, **_kwargs):
        self.use_stub = use_stub
        if use_stub:
            print("[InferenceEngine] Running in STUB mode")
        else:
            print(f"[InferenceEngine] Using YOLO service at {YOLO_SERVICE_URL}")

    def predict(self, frame: np.ndarray) -> list[dict]:
        if self.use_stub:
            return self._stub_detections(frame)
        return self._predict_via_service(frame)

    def _predict_via_service(self, frame: np.ndarray) -> list[dict]:
        _, buf = cv2.imencode(".jpg", frame)
        jpg_bytes = buf.tobytes()

        try:
            resp = requests.post(
                YOLO_SERVICE_URL,
                files={"file": ("frame.jpg", io.BytesIO(jpg_bytes), "image/jpeg")},
                timeout=YOLO_TIMEOUT_S,
            )
            resp.raise_for_status()
            detections = resp.json().get("detections", [])
            
            if detections:
                print(f"[FastAPI][YOLO_DEFECTS] Detected {len(detections)} features:")
                for d in detections:
                    print(f"  - Label: {d['label']}, Conf: {d['confidence']}, Bbox: {d['bbox_px']}, Defect: {d['defect']}, Severity: {d['severity']}")
            
            return detections
        except requests.exceptions.ConnectionError:
            print("[InferenceEngine] YOLO service unreachable — is it running on port 5002?")
            return []
        except Exception as e:
            print(f"[InferenceEngine] YOLO service error: {e}")
            return []

    def _stub_detections(self, frame: np.ndarray) -> list[dict]:
        """Cycles through fake detections for UI testing."""
        t = int(time.time() * 1.2) % 10

        base = [
            {"id": 1, "label": "wheel",        "confidence": 0.98, "bbox_px": [80,  200, 200, 220], "defect": False, "severity": None},
            {"id": 2, "label": "axle_box_cover","confidence": 0.95, "bbox_px": [400, 180, 160, 150], "defect": False, "severity": None},
            {"id": 3, "label": "brake_lever",  "confidence": 0.96, "bbox_px": [240, 280, 130, 110], "defect": False, "severity": None},
        ]
        defects = [
            {"id": 4, "label": "rust",    "confidence": 0.87, "bbox_px": [100, 250, 90,  80], "defect": True, "severity": "HIGH"},
            {"id": 5, "label": "leakage", "confidence": 0.91, "bbox_px": [90,  260, 110, 90], "defect": True, "severity": "CRITICAL"},
        ]

        if t in (5, 6, 7):
            return base + defects[:1]
        if t == 8:
            return base[:1] + defects
        return base
