import os
import uuid
import tempfile
import time

import cv2
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO

from src.preprocess.preprocess import preprocess_frame
from src.ocr.ocr_engine import run_ocr
from src.filtering.train_number_filter import filter_train_numbers
from src.voting.vote_manager import VoteManager
from src.capture.video_reader import read_video

app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)

UPLOAD_DIR = tempfile.gettempdir()


def log_stage(stage: str, **payload):
    details = " ".join(f"{k}={v}" for k, v in payload.items())
    print(f"[OCR][{stage}] {details}".rstrip())

# ── Load YOLOv8 Model ────────────────────────────────────────────────────────
MODEL_PATH = "runs/detect/runs/railway_inspection_v1-2/weights/best.pt"
if not os.path.exists(MODEL_PATH):
    # Fallback to any best.pt if the specific one is missing
    MODEL_PATH = "yolov8n.pt" 

yolo_model = YOLO(MODEL_PATH)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")


def process_compare(frame):
    # --- METHOD 1: FULL IMAGE OCR ---
    m1_start = time.time()
    log_stage("M1_START", shape=frame.shape)
    m1_processed = preprocess_frame(frame)
    log_stage("M1_PREPROCESS_DONE", shape=m1_processed.shape)
    m1_ocr_results = run_ocr(m1_processed)
    log_stage("M1_OCR_DONE", detections=len(m1_ocr_results), sample=m1_ocr_results[:3])
    log_stage("M1_FILTER_START")
    m1_candidates = filter_train_numbers(m1_ocr_results)
    log_stage("M1_FILTER_DONE", candidates=m1_candidates)
    m1_total_time = (time.time() - m1_start) * 1000  # ms

    # --- METHOD 2: YOLOv8 + CROPPED OCR ---
    m2_start = time.time()
    
    # 1. Detection
    det_start = time.time()
    log_stage("M2_DET_START", shape=frame.shape)
    results = yolo_model(frame, conf=0.25, verbose=False)
    det_time = (time.time() - det_start) * 1000
    log_stage("M2_DET_DONE", detections=len(results[0].boxes) if len(results) > 0 else 0, det_ms=round(det_time, 2))
    
    m2_best = None
    m2_best_source = None
    m2_candidates = []
    m2_ocr_results = []
    crop_time = 0
    ocr_time = 0

    if len(results) > 0 and len(results[0].boxes) > 0:
        box = results[0].boxes[0]
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        log_stage("M2_BOX_SELECTED", x1=x1, y1=y1, x2=x2, y2=y2)
        
        crop_start = time.time()
        h, w = frame.shape[:2]
        y1, y2 = max(0, y1-10), min(h, y2+10)
        x1, x2 = max(0, x1-10), min(w, x2+10)
        cropped_frame = frame[y1:y2, x1:x2]
        crop_time = (time.time() - crop_start) * 1000
        log_stage("M2_CROP_DONE", crop_ms=round(crop_time, 2), crop_shape=cropped_frame.shape)
        
        ocr_start = time.time()
        m2_processed = preprocess_frame(cropped_frame)
        log_stage("M2_PREPROCESS_DONE", shape=m2_processed.shape)
        m2_ocr_results = run_ocr(m2_processed)
        log_stage("M2_OCR_DONE", detections=len(m2_ocr_results), sample=m2_ocr_results[:3])
        log_stage("M2_FILTER_START")
        m2_candidates = filter_train_numbers(m2_ocr_results)
        ocr_time = (time.time() - ocr_start) * 1000
        if m2_candidates:
            m2_best = m2_candidates[0]
            m2_best_source = "crop"
        else:
            # Fallback: some OCR engines emit the digits in a looser form.
            fallback_digits = []
            for item in m2_ocr_results:
                digits = "".join(ch for ch in str(item.get("text", "")) if ch.isdigit())
                if 5 <= len(digits) <= 6:
                    fallback_digits.append(digits)
            if fallback_digits:
                m2_best = fallback_digits[0]
                m2_best_source = "ocr_digits"
                m2_candidates = fallback_digits
            else:
                # Final fallback: wider crop on the full frame so method2 still reports a value.
                log_stage("M2_FALLBACK_FULL_FRAME_START")
                widened_processed = preprocess_frame(frame)
                widened_ocr = run_ocr(widened_processed)
                widened_candidates = filter_train_numbers(widened_ocr)
                log_stage("M2_FALLBACK_FULL_FRAME_DONE", detections=len(widened_ocr), candidates=widened_candidates)
                if widened_candidates:
                    m2_best = widened_candidates[0]
                    m2_best_source = "full_frame_fallback"
                    m2_candidates = widened_candidates
                    m2_ocr_results = widened_ocr
                else:
                    m2_best_source = "none"
        log_stage("M2_FILTER_DONE", candidates=m2_candidates, best=m2_best, source=m2_best_source)
    else:
        log_stage("M2_NO_BOXES", action="fallback_full_frame")
        fallback_start = time.time()
        widened_processed = preprocess_frame(frame)
        log_stage("M2_FALLBACK_FULL_FRAME_PREPROCESS_DONE", shape=widened_processed.shape)
        m2_ocr_results = run_ocr(widened_processed)
        log_stage("M2_FALLBACK_FULL_FRAME_OCR_DONE", detections=len(m2_ocr_results), sample=m2_ocr_results[:3])
        m2_candidates = filter_train_numbers(m2_ocr_results)
        if not m2_candidates:
            fallback_digits = []
            for item in m2_ocr_results:
                digits = "".join(ch for ch in str(item.get("text", "")) if ch.isdigit())
                if 5 <= len(digits) <= 6:
                    fallback_digits.append(digits)
            m2_candidates = fallback_digits
        if m2_candidates:
            m2_best = m2_candidates[0]
            m2_best_source = "full_frame_fallback"
        else:
            m2_best_source = "none"
        ocr_time += (time.time() - fallback_start) * 1000
        log_stage("M2_FALLBACK_FULL_FRAME_DONE", candidates=m2_candidates, best=m2_best, source=m2_best_source)

    m2_total_time = (time.time() - m2_start) * 1000
    
    if not m2_best and m2_candidates:
        m2_best = m2_candidates[0]
    log_stage("COMPARE_DONE", m1_best=(m1_candidates[0] if m1_candidates else None), m2_best=m2_best, m2_source=m2_best_source)

    return {
        "m1": {
            "total": m1_total_time, 
            "best": m1_candidates[0] if m1_candidates else None,
            "all_text": [item["text"] for item in m1_ocr_results]
        },
        "m2": {
            "total": m2_total_time, 
            "det": det_time, 
            "crop": crop_time, 
            "ocr": ocr_time, 
            "best": m2_best,
            "best_source": m2_best_source,
            "candidates": m2_candidates,
            "all_text": [item["text"] for item in m2_ocr_results]
        }
    }


@app.route("/api/ocr/compare", methods=["POST"])
def compare_ocr():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)

    try:
        frame = cv2.imread(tmp_path)
        if frame is None:
            return jsonify({"error": "Cannot decode image"}), 422

        res = process_compare(frame)
        return jsonify({
            "method1": {
                "total_ms": round(res["m1"]["total"], 2),
                "best": res["m1"]["best"],
                "all_text": res["m1"]["all_text"],
                "train_number_candidates": [res["m1"]["best"]] if res["m1"]["best"] else [],
            },
            "method2": {
                "total_ms": round(res["m2"]["total"], 2),
                "det_ms": round(res["m2"]["det"], 2),
                "crop_ms": round(res["m2"]["crop"], 2),
                "ocr_ms": round(res["m2"]["ocr"], 2),
                "best": res["m2"]["best"],
                "best_source": res["m2"]["best_source"],
                "all_text": res["m2"]["all_text"],
                "train_number_candidates": [res["m2"]["best"]] if res["m2"]["best"] else [],
            },
            "saving": round(res["m1"]["total"] - res["m2"]["total"], 2)
        })

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route("/api/ocr/video_compare", methods=["POST"])
def video_compare():
    log_stage("VIDEO_COMPARE_START")
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    frame_skip = int(request.form.get("frame_skip", 10))
    max_frames = int(request.form.get("max_frames", 5)) # Benchmarking 5 frames is enough to prove it

    ext = os.path.splitext(file.filename)[1].lower() or ".mp4"
    tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    file.save(tmp_path)
    log_stage("VIDEO_COMPARE_FILE", filename=file.filename, frame_skip=frame_skip, max_frames=max_frames)

    try:
        m1_times = []
        m2_times = []
        m1_numbers = {} # Using dict to count occurrences
        m2_numbers = {}
        m2_breakdown = {"det": [], "ocr": []}
        
        frame_count = 0
        processed_count = 0

        for frame in read_video(tmp_path):
            frame_count += 1
            if frame_count % frame_skip != 0:
                continue
            
            processed_count += 1
            log_stage("VIDEO_COMPARE_FRAME_START", frame=frame_count, processed=processed_count)
            res = process_compare(frame)
            log_stage("VIDEO_COMPARE_FRAME_DONE", frame=frame_count, m1_best=res["m1"]["best"], m2_best=res["m2"]["best"])
            
            m1_times.append(res["m1"]["total"])
            m2_times.append(res["m2"]["total"])
            m2_breakdown["det"].append(res["m2"]["det"])
            m2_breakdown["ocr"].append(res["m2"]["ocr"])

            # Collect numbers
            if res["m1"]["best"]:
                m1_numbers[res["m1"]["best"]] = m1_numbers.get(res["m1"]["best"], 0) + 1
            if res["m2"]["best"]:
                m2_numbers[res["m2"]["best"]] = m2_numbers.get(res["m2"]["best"], 0) + 1

            if processed_count >= max_frames:
                break

        if not m1_times:
            return jsonify({"error": "No frames processed"}), 400

        avg_m1 = sum(m1_times) / len(m1_times)
        avg_m2 = sum(m2_times) / len(m2_times)
        avg_det = sum(m2_breakdown["det"]) / len(m2_breakdown["det"])
        avg_ocr = sum(m2_breakdown["ocr"]) / len(m2_breakdown["ocr"])

        return jsonify({
            "method1": {
                "avg_ms": round(avg_m1, 2),
                "detections": m1_numbers,
                "train_number_candidates": list(m1_numbers.keys()),
            },
            "method2": {
                "avg_ms": round(avg_m2, 2),
                "avg_det_ms": round(avg_det, 2),
                "avg_ocr_ms": round(avg_ocr, 2),
                "detections": m2_numbers,
                "train_number_candidates": list(m2_numbers.keys()),
            },
            "saving_avg": round(avg_m1 - avg_m2, 2),
            "frames_benchmarked": processed_count
        })

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)



@app.before_request
def log_request_info():
    print(f"Incoming Request: {request.method} {request.path}")

if __name__ == "__main__":
    print("\n" + "="*55)
    print("  Train Number OCR Comparison Server")
    print("  Loading models...")
    print(f"  YOLOv8: {MODEL_PATH}")
    print("="*55)

    app.run(host="0.0.0.0", port=5001, debug=True, use_reloader=False)
