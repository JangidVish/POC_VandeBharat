import os
import sys
import uuid
import tempfile
import json
import base64
import time

# Ensure src/ is importable
sys.path.insert(0, os.path.dirname(__file__))


import cv2
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
# Use the specifically trained model for the coach number region
MODEL_PATH = os.path.join(os.path.dirname(__file__), "railway_inspection_v1-2", "weights", "best.pt")
yolo_model = None

def get_yolo():
    global yolo_model
    if yolo_model is None:
        print(f"[OCRv2] Loading CUSTOM YOLOv8 region detector: {MODEL_PATH}")
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
    results = model(frame, conf=0.15, verbose=False)
    
    best_ocr_results = []
    candidates = []
    crop_info = None

    if len(results) > 0 and len(results[0].boxes) > 0:
        print(f"[OCRv2] Custom Model detected {len(results[0].boxes)} regions.")
        # Take the best detection
        box = results[0].boxes[0]
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        
        # Fixed padding (10px) as per OCR2 reference
        y1, y2 = max(0, y1 - 10), min(h, y2 + 10)
        x1, x2 = max(0, x1 - 10), min(w, x2 + 10)
        
        crop_info = [x1, y1, x2 - x1, y2 - y1]
        roi = frame[y1:y2, x1:x2]
        
        # 2. Process ROI
        processed = preprocess_frame(roi)
        best_ocr_results = run_ocr(processed)
        candidates = filter_train_numbers(best_ocr_results)
        
        # OCR2 Fallback: if filter failed, try cleaning digits manually
        if not candidates:
            for item in best_ocr_results:
                digits = "".join(ch for ch in str(item.get("text", "")) if ch.isdigit())
                if 5 <= len(digits) <= 6:
                    candidates.append(digits)
        
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
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}.jpg")
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

@app.route("/api/ocr/video/stream", methods=["POST"])
def ocr_video_stream():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    vote_threshold = int(request.form.get("vote_threshold", 5))
    interval_ms    = float(request.form.get("interval_ms", 500))

    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}.mp4")
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
                res = process_advanced(frame)
                
                if res["candidates"]:
                    vote_manager.add_candidates(res["candidates"])

                thumb    = cv2.resize(frame, (160, 90))
                _, buf   = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 55])
                thumb_b64 = base64.b64encode(buf).decode()

                yield _sse({
                    "type": "frame",
                    "frame": processed_count,
                    "progress": round((idx + 1) / total_to_process * 100, 1),
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
    app.run(host="0.0.0.0", port=5000, debug=True)
