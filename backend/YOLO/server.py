"""
YOLO Defect Detection Server
Loads best.pt ONCE at startup — all subsequent requests are fast.

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
CONF_THRESHOLD = float(os.environ.get("YOLO_CONF", "0.35"))
PORT = int(os.environ.get("YOLO_PORT", "5001"))

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

# ─── Model ────────────────────────────────────────────────────────────────────

model = None


def load_model():
    global model
    from ultralytics import YOLO
    abs_path = os.path.abspath(MODEL_PATH)
    print(f"  Loading model from: {abs_path}")
    model = YOLO(abs_path)
    # Warmup pass
    blank = np.zeros((640, 640, 3), dtype="uint8")
    model(blank, verbose=False)
    print("  Model warmed up.")


# ─── App ──────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)


@app.route("/api/yolo/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_path": os.path.abspath(MODEL_PATH),
        "conf_threshold": CONF_THRESHOLD,
        "classes": model.names if model else None,
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

        results = model(frame, conf=CONF_THRESHOLD, verbose=False)[0]
        h, w = frame.shape[:2]
        detections = []

        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = model.names[int(box.cls)]
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
        os.remove(tmp_path)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 55)
    print("  YOLO Defect Detection Server")
    print("  Loading model (one-time, may take a few seconds)...")
    print("=" * 55)

    load_model()

    print(f"  Server ready at http://localhost:{PORT}")
    print(f"  Confidence threshold: {CONF_THRESHOLD}")
    print("=" * 55 + "\n")

    app.run(host="0.0.0.0", port=PORT, debug=False)
