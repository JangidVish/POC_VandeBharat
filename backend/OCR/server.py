"""
Train Number OCR Server (v2 — High Accuracy)
Uses YOLOv8 to find the coach number region, then crops and runs PaddleOCR.
"""

import os
import sys
import uuid
import tempfile
import json
import base64
import time

# Disable MKLDNN globally to fix "OneDnnContext does not have the input Filter" crash
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_ir_optim"] = "0"

# Ensure src/ is importable
sys.path.insert(0, os.path.dirname(__file__))

import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

from src.preprocess.preprocess import preprocess_frame
from src.ocr.ocr_engine import run_ocr
from src.filtering.train_number_filter import filter_train_numbers
from src.voting.vote_manager import VoteManager
from src.capture.video_reader import read_video

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = tempfile.gettempdir()

# ── YOLO Model Initialization ────────────────────────────────────────────────
# Use yolov8n.pt as primary detector for the number region
MODEL_PATH = os.path.join(os.path.dirname(__file__), "yolov8n.pt")
yolo_model = None

def get_yolo():
    global yolo_model
    if yolo_model is None:
        print(f"[OCRv2] Loading YOLOv8 region detector: {MODEL_PATH}")
        yolo_model = YOLO(MODEL_PATH)
    return yolo_model

# ── Advanced OCR Pipeline ─────────────────────────────────────────────────────

def process_advanced(frame):
    """
    Detect -> Crop -> OCR pipeline for higher accuracy.
    """
    model = get_yolo()
    h, w = frame.shape[:2]
    
    # 1. Detect ROI (Region of Interest)
    results = model(frame, conf=0.25, verbose=False)
    
    best_ocr_results = []
    candidates = []
    crop_info = None

    if len(results) > 0 and len(results[0].boxes) > 0:
        # Take the best detection
        box = results[0].boxes[0]
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        
        # Add 10% padding
        pad_h = int((y2 - y1) * 0.1)
        pad_w = int((x2 - x1) * 0.1)
        y1, y2 = max(0, y1 - pad_h), min(h, y2 + pad_h)
        x1, x2 = max(0, x1 - pad_w), min(w, x2 + pad_w)
        
        crop_info = [x1, y1, x2 - x1, y2 - y1]
        roi = frame[y1:y2, x1:x2]
        
        # 2. Process ROI
        processed = preprocess_frame(roi)
        best_ocr_results = run_ocr(processed)
        candidates = filter_train_numbers(best_ocr_results)
        
    # 3. Fallback to full frame if no candidates found in ROI
    if not candidates:
        print("[OCRv2] ROI detection failed or empty, falling back to full frame...")
        processed = preprocess_frame(frame)
        full_ocr = run_ocr(processed)
        candidates = filter_train_numbers(full_ocr)
        if not best_ocr_results:
            best_ocr_results = full_ocr

    return {
        "ocr_results": best_ocr_results,
        "candidates": candidates,
        "roi_box": crop_info
    }

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/ocr/image", methods=["POST"])
def ocr_image():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)

    try:
        frame = cv2.imread(tmp_path)
        if frame is None:
            return jsonify({"error": "Cannot decode image"}), 422

        res = process_advanced(frame)

        return jsonify({
            "detections": res["ocr_results"],
            "train_number_candidates": res["candidates"],
            "best": res["candidates"][0] if res["candidates"] else None,
            "roi": res["roi_box"]
        })
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route("/api/ocr/video", methods=["POST"])
def ocr_video():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    frame_skip = int(request.form.get("frame_skip", 5))
    vote_threshold = int(request.form.get("vote_threshold", 5))

    ext = os.path.splitext(file.filename)[1].lower() or ".mp4"
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)

    try:
        vote_manager = VoteManager(threshold=vote_threshold)
        frame_count = 0
        processed_count = 0
        detection_log = []

        for frame in read_video(tmp_path):
            frame_count += 1
            if frame_count % frame_skip != 0:
                continue

            processed_count += 1
            res = process_advanced(frame)

            if res["candidates"]:
                vote_manager.add_candidates(res["candidates"])
                detection_log.append({
                    "frame": frame_count, 
                    "candidates": res["candidates"],
                    "roi": res["roi_box"]
                })

        best = vote_manager.get_best_candidate()

        return jsonify({
            "best": best,
            "votes": vote_manager.get_all_votes(),
            "frames_read": frame_count,
            "frames_processed": processed_count,
            "detection_log": detection_log,
        })
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route("/api/ocr/video/stream", methods=["POST"])
def ocr_video_stream():
    """SSE endpoint for real-time progress in the UI."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    vote_threshold = int(request.form.get("vote_threshold", 5))
    interval_ms    = float(request.form.get("interval_ms", 500))

    ext      = os.path.splitext(file.filename)[1].lower() or ".mp4"
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    def generate():
        cap = None
        try:
            cap = cv2.VideoCapture(tmp_path)
            if not cap.isOpened():
                yield _sse({"type": "error", "message": "Cannot open video file"})
                return

            source_fps   = cap.get(cv2.CAP_PROP_FPS) or 25
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration_ms  = (total_frames / source_fps) * 1000

            step_ms     = max(interval_ms, 40)
            timestamps  = []
            t = 0.0
            while t <= duration_ms:
                timestamps.append(t)
                t += step_ms
            total_to_process = len(timestamps)

            yield _sse({
                "type": "init",
                "total_frames": total_to_process,
                "source_fps": round(source_fps, 2),
                "interval_ms": step_ms,
            })

            vote_manager    = VoteManager(threshold=vote_threshold)
            processed_count = 0

            for idx, seek_ms in enumerate(timestamps):
                cap.set(cv2.CAP_PROP_POS_MSEC, seek_ms)
                ret, frame = cap.read()
                if not ret: continue

                processed_count += 1
                
                # Use Advanced Pipeline
                res = process_advanced(frame)
                
                if res["candidates"]:
                    vote_manager.add_candidates(res["candidates"])

                # Thumbnail for UI
                thumb    = cv2.resize(frame, (160, 90))
                _, buf   = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 55])
                thumb_b64 = base64.b64encode(buf).decode()

                yield _sse({
                    "type": "frame",
                    "frame": processed_count,
                    "progress": round((idx + 1) / total_to_process * 100, 1),
                    "timestamp_ms": round(seek_ms, 1),
                    "candidates": res["candidates"],
                    "votes": vote_manager.get_all_votes(),
                    "thumbnail": thumb_b64,
                    "ocr_texts": [{"text": d["text"], "confidence": round(d["confidence"], 3)}
                                  for d in res["ocr_results"]],
                    "roi": res["roi_box"]
                })

            best = vote_manager.get_best_candidate()
            yield _sse({
                "type": "done",
                "best": best,
                "votes": vote_manager.get_all_votes(),
                "frames_processed": processed_count,
            })

        except Exception as exc:
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            if cap: cap.release()
            if os.path.exists(tmp_path): os.remove(tmp_path)

    return app.response_class(generate(), mimetype="text/event-stream")

if __name__ == "__main__":
    print("\n" + "=" * 55)
    print("  Vande Bharat OCR v2 (High Accuracy)")
    print("  Status: YOLO + PaddleOCR Hybrid Ready")
    print("=" * 55 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
