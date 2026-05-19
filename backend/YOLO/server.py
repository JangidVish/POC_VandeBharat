"""
YOLO Defect & Train Number Detection Server
Loads both models ONCE on the GPU at startup — all subsequent requests are fast.

Run from POC/backend/YOLO/:
    python server.py
"""

import os
import sys
import uuid
import tempfile

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# ─── Config ───────────────────────────────────────────────────────────────────

MODEL_PATH = os.environ.get(
    "YOLO_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "models", "best.pt"),
)
OCR_MODEL_PATH = os.environ.get(
    "YOLO_OCR_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "OCR", "models", "train_num_detector.pt"),
)
CONF_THRESHOLD = float(os.environ.get("YOLO_CONF", "0.35"))
PORT = int(os.environ.get("YOLO_PORT", "5002"))

# Defect classes — indices 32-42 in best.pt
DEFECT_LABELS = {
    "crack", "rust", "leakage", "deformation",
    "missing_part", "broken", "puncture",
    "hanging", "loose", "hole", "smoke_emission",
}

SEVERITY_MAP = {
    "crack":          "CRITICAL",
    "leakage":        "CRITICAL",
    "smoke_emission": "CRITICAL",
    "broken":         "HIGH",
    "rust":           "HIGH",
    "deformation":    "HIGH",
    "hole":           "HIGH",
    "missing_part":   "MEDIUM",
    "puncture":       "MEDIUM",
    "hanging":        "MEDIUM",
    "loose":          "LOW",
}

# ─── Models ───────────────────────────────────────────────────────────────────

defect_model = None
ocr_detector_model = None


def load_models():
    global defect_model, ocr_detector_model
    from ultralytics import YOLO
    import torch
    
    device = os.environ.get("YOLO_DEVICE", "cuda:0" if torch.cuda.is_available() else "cpu")
    
    # 1. Load Defect Detection Model
    abs_defect_path = os.path.abspath(MODEL_PATH)
    print(f"  Loading Defect Model from: {abs_defect_path}")
    print(f"  Target device: {device}")
    defect_model = YOLO(abs_defect_path)
    defect_model.to(device)
    
    # 2. Load Train Number Detector Model
    abs_ocr_path = os.path.abspath(OCR_MODEL_PATH)
    print(f"  Loading Train Number Detector Model from: {abs_ocr_path}")
    ocr_detector_model = YOLO(abs_ocr_path)
    ocr_detector_model.to(device)
    
    # Warmup passes for both
    blank = np.zeros((640, 640, 3), dtype="uint8")
    defect_model(blank, verbose=False)
    ocr_detector_model(blank, verbose=False)
    print(f"  Both YOLO models warmed up successfully on {device}.")


# ─── App ──────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)


@app.route("/api/yolo/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "defect_model_path": os.path.abspath(MODEL_PATH),
        "ocr_model_path": os.path.abspath(OCR_MODEL_PATH),
        "conf_threshold": CONF_THRESHOLD,
        "defect_classes": defect_model.names if defect_model else None,
        "ocr_classes": ocr_detector_model.names if ocr_detector_model else None,
    })


@app.route("/api/yolo/predict", methods=["POST"])
def predict():
    """
    Accepts a JPEG/PNG frame as multipart file upload.
    Returns list of detections with bbox, label, confidence, defect flag.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)

    try:
        frame = cv2.imread(tmp_path)
        if frame is None:
            return jsonify({"error": "Cannot decode image"}), 422

        results = defect_model(frame, conf=CONF_THRESHOLD, verbose=False)[0]
        h, w = frame.shape[:2]
        detections = []

        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = defect_model.names[int(box.cls)]
            conf = float(box.conf)
            is_defect = label in DEFECT_LABELS

            detections.append({
                "id": i,
                "label": label,
                "confidence": round(conf, 3),
                "bbox_px": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                "defect": is_defect,
                "severity": SEVERITY_MAP.get(label) if is_defect else None,
            })

        return jsonify({"detections": detections, "frame_size": [w, h]})

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route("/api/yolo/predict_train_number", methods=["POST"])
def predict_train_number():
    """
    Accepts a JPEG/PNG frame as multipart file upload.
    Returns list of train number bounding boxes on the GPU.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)

    try:
        frame = cv2.imread(tmp_path)
        if frame is None:
            return jsonify({"error": "Cannot decode image"}), 422

        results = ocr_detector_model(frame, conf=0.25, verbose=False)[0]
        h, w = frame.shape[:2]
        boxes = []

        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf)
            cls_id = int(box.cls)
            label = ocr_detector_model.names[cls_id]
            boxes.append({
                "bbox_xyxy": [int(x1), int(y1), int(x2), int(y2)],
                "confidence": round(conf, 3),
                "class_id": cls_id,
                "label": label,
            })

        if boxes:
            print(f"[YOLO][OCR_DETECT] Detected {len(boxes)} boxes:")
            for b in boxes:
                print(f"  - Label: {b['label']}, Conf: {b['confidence']}, Bbox: {b['bbox_xyxy']}")
        else:
            print("[YOLO][OCR_DETECT] No candidate boxes found.")

        return jsonify({"boxes": boxes, "frame_size": [w, h]})

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 55)
    print("  YOLO Defect & Train Number Detection Server")
    print("  Loading models (one-time, may take a few seconds)...")
    print("=" * 55)

    load_models()

    print(f"  Server ready at http://localhost:{PORT}")
    print(f"  Confidence threshold: {CONF_THRESHOLD}")
    print("=" * 55 + "\n")

    app.run(host="0.0.0.0", port=PORT, debug=False)
