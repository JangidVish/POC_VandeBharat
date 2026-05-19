"""
Train Number OCR Server (YOLO-Cropping + PaddleOCR)
Loads models ONCE at startup — all subsequent requests are fast.
Queries the YOLO service over local HTTP loopback for GPU-based cropping.

Run from POC/backend/OCR/:
    python server.py
"""

import os
import sys
import uuid
import tempfile
import json
import base64
import requests

# Ensure src/ is importable when running from this directory
sys.path.insert(0, os.path.dirname(__file__))

import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS

from src.preprocess.preprocess import preprocess_frame
from src.ocr.ocr_engine import run_ocr
from src.filtering.train_number_filter import filter_train_numbers
from src.voting.vote_manager import VoteManager
from src.capture.video_reader import read_video

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = tempfile.gettempdir()

# ─── Config ───────────────────────────────────────────────────────────────────

YOLO_SERVICE_URL = os.environ.get(
    "YOLO_SERVICE_URL",
    "http://localhost:5002/api/yolo/predict_train_number"
)


# ─── Pipeline Helper ───────────────────────────────────────────────────────────

import numpy as np

def draw_detections(frame, yolo_boxes, ocr_results, crop_offsets=None):
    """
    Draws YOLO defect/train number bounding boxes and PaddleOCR text detections
    directly on a copy of the frame for front-end rendering.
    """
    annotated = frame.copy()
    ox, oy = (0, 0) if crop_offsets is None else crop_offsets
    
    # 1. Draw YOLO boxes in Neon Green (BGR: 0, 255, 0)
    for box in yolo_boxes:
        x1, y1, x2, y2 = box["bbox_xyxy"]
        label = box.get("label", "Boogie")
        conf = box.get("confidence", 0.0)
        
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        text = f"{label} {int(conf * 100)}%"
        cv2.putText(annotated, text, (x1, max(y1 - 10, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
    # 2. Draw OCR boxes in Neon Yellow (BGR: 0, 255, 255)
    for item in ocr_results:
        pts = item.get("box")
        if pts:
            mapped_pts = []
            for p in pts:
                px = int(round(p[0] + ox))
                py = int(round(p[1] + oy))
                mapped_pts.append([px, py])
            
            mapped_pts = np.array(mapped_pts, np.int32)
            cv2.polylines(annotated, [mapped_pts], isClosed=True, color=(0, 255, 255), thickness=2)
            
            tx, ty = mapped_pts[0]
            cv2.putText(annotated, item["text"], (tx, max(ty - 5, 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1, cv2.LINE_AA)
            
    return annotated


def process_ocr_pipeline(frame):
    """
    Runs the YOLOv8 Crop + OCR pipeline with a full-frame fallback.
    Queries the GPU-accelerated YOLO service for crop coordinates.
    Prioritizes case-insensitive 'Boogie' class boxes and isolates crop OCR.
    Returns: (ocr_results, candidates, best_candidate, source, yolo_boxes, annotated_frame)
    """
    h, w = frame.shape[:2]
    yolo_boxes = []
    crop_offsets = None
    
    print("\n" + "=" * 55)
    print(f"[OCR] Processing frame of size {w}x{h}...")
    
    # 1. Try YOLOv8 Crop + OCR via YOLO service over local HTTP
    try:
        print("[OCR] Querying YOLO service on port 5002 for crop boxes...")
        _, img_encoded = cv2.imencode(".jpg", frame)
        files = {"file": ("frame.jpg", img_encoded.tobytes(), "image/jpeg")}
        
        response = requests.post(YOLO_SERVICE_URL, files=files, timeout=2.0)
        if response.status_code == 200:
            yolo_boxes = response.json().get("boxes", [])
            print(f"[OCR] YOLO service returned {len(yolo_boxes)} boxes.")
            
            if yolo_boxes:
                # Prioritize 'Boogie' class boxes case-insensitively, else fallback to first box
                boogie_boxes = [b for b in yolo_boxes if b.get("label", "").lower() == "boogie"]
                box = boogie_boxes[0] if boogie_boxes else yolo_boxes[0]
                
                x1, y1, x2, y2 = box["bbox_xyxy"]
                label_name = box.get("label", "Boogie")
                confidence = box.get("confidence", 0.0)
                class_id = box.get("class_id", 0)
                
                print(f"[OCR][LABEL_VERIFY] Using prioritized YOLO label: '{label_name}' (class_id={class_id}, conf={confidence})")
                print(f"  - Original YOLO box: [{x1}, {y1}, {x2}, {y2}]")
                
                # Apply dynamic 15% padding on all sides to avoid edge clipping
                box_w = x2 - x1
                box_h = y2 - y1
                pad_w = int(box_w * 0.15)
                pad_h = int(box_h * 0.15)
                
                y1_pad = max(0, y1 - pad_h)
                y2_pad = min(h, y2 + pad_h)
                x1_pad = max(0, x1 - pad_w)
                x2_pad = min(w, x2 + pad_w)
                
                print(f"  - Padded crop box (15% padding): [{x1_pad}, {y1_pad}, {x2_pad}, {y2_pad}]")
                
                cropped_frame = frame[y1_pad:y2_pad, x1_pad:x2_pad]
                if cropped_frame.size > 0:
                    # ── Pass 1: Raw BGR Inference ──
                    print("[OCR][Pass 1] Running PaddleOCR on RAW BGR crop (preserves border clarity)...")
                    ocr_results = run_ocr(cropped_frame)
                    candidates = filter_train_numbers(ocr_results)
                    source_tag = "crop"
                    
                    # ── Pass 2: Preprocessed Self-Healing Retry ──
                    if not candidates:
                        print("[OCR][Pass 2] Pass 1 returned no candidates. Retrying with preprocessed crop...")
                        processed = preprocess_frame(cropped_frame)
                        ocr_results_p2 = run_ocr(processed)
                        candidates_p2 = filter_train_numbers(ocr_results_p2)
                        
                        if candidates_p2:
                            print("[OCR][Pass 2] Self-healing retry successfully found candidates!")
                            ocr_results = ocr_results_p2
                            candidates = candidates_p2
                            source_tag = "crop_preprocessed"
                    
                    print(f"[OCR] Crop OCR results: {[{'text': item['text'], 'confidence': round(item['confidence'], 2)} for item in ocr_results]}")
                    print(f"[OCR] Crop Bogie number candidates: {candidates}")
                    
                    if candidates:
                        crop_offsets = (x1_pad, y1_pad)
                        annotated_frame = draw_detections(frame, yolo_boxes, ocr_results, crop_offsets)
                        return ocr_results, candidates, candidates[0], source_tag, yolo_boxes, annotated_frame
                    
                    # Fallback 1: Extract any 5-6 digit strings from the crop
                    fallback_digits = []
                    for item in ocr_results:
                        digits = "".join(ch for ch in str(item.get("text", "")) if ch.isdigit())
                        if 5 <= len(digits) <= 6:
                            fallback_digits.append(digits)
                    if fallback_digits:
                        print(f"[OCR] Found fallback digits in crop: {fallback_digits}")
                        crop_offsets = (x1_pad, y1_pad)
                        annotated_frame = draw_detections(frame, yolo_boxes, ocr_results, crop_offsets)
                        return ocr_results, fallback_digits, fallback_digits[0], "ocr_digits", yolo_boxes, annotated_frame
        else:
            print(f"[OCR] YOLO service returned error code: {response.status_code}")
    except Exception as exc:
        print(f"[OCR] YOLO Crop pipeline HTTP error: {exc}. Falling back to full frame.")

    # 2. Fallback to Full Frame OCR
    print("[OCR] Crop yielded no matches or YOLO failed. Attempting Full Frame OCR fallback...")
    processed = preprocess_frame(frame)
    ocr_results = run_ocr(processed)
    candidates = filter_train_numbers(ocr_results)
    
    print(f"[OCR] Full Frame OCR results: {[{'text': item['text'], 'confidence': round(item['confidence'], 2)} for item in ocr_results]}")
    print(f"[OCR] Full Frame Train number candidates: {candidates}")
    
    annotated_frame = draw_detections(frame, yolo_boxes, ocr_results, crop_offsets=None)
    
    if candidates:
        return ocr_results, candidates, candidates[0], "full_frame_fallback", yolo_boxes, annotated_frame
        
    # Fallback 2: Extract any 5-6 digit strings from full frame
    fallback_digits = []
    for item in ocr_results:
        digits = "".join(ch for ch in str(item.get("text", "")) if ch.isdigit())
        if 5 <= len(digits) <= 6:
            fallback_digits.append(digits)
    if fallback_digits:
        print(f"[OCR] Found fallback digits in full frame: {fallback_digits}")
        return ocr_results, fallback_digits, fallback_digits[0], "full_frame_fallback_digits", yolo_boxes, annotated_frame
        
    return ocr_results, [], None, "none", yolo_boxes, annotated_frame


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/ocr/image", methods=["POST"])
def ocr_image():
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

        ocr_results, candidates, best, source, yolo_boxes, annotated_frame = process_ocr_pipeline(frame)

        # Base64 encode the annotated image to send to the UI
        _, img_encoded = cv2.imencode(".jpg", annotated_frame)
        annotated_b64 = base64.b64encode(img_encoded).decode()

        return jsonify({
            "detections": ocr_results,
            "train_number_candidates": candidates,
            "best": best,
            "source": source,
            "yolo_boxes": yolo_boxes,
            "annotated_image": f"data:image/jpeg;base64,{annotated_b64}"
        })
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route("/api/ocr/video", methods=["POST"])
def ocr_video():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

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
            ocr_results, candidates, best, source, yolo_boxes, annotated_frame = process_ocr_pipeline(frame)

            if candidates:
                vote_manager.add_candidates(candidates)
                detection_log.append({
                    "frame": frame_count, 
                    "candidates": candidates,
                    "best": best,
                    "source": source
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
    """SSE endpoint — streams per-frame progress while processing the video."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    vote_threshold = int(request.form.get("vote_threshold", 5))
    interval_ms    = float(request.form.get("interval_ms", 500))   # time-based seeking

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

            # Build the exact list of timestamps to seek
            step_ms     = max(interval_ms, 40)          # floor at 40ms = 25fps
            timestamps  = []
            t = 0.0
            while t <= duration_ms:
                timestamps.append(t)
                t += step_ms
            total_to_process = len(timestamps)

            print(f"[OCR-STREAM] Video: {source_fps:.1f} fps  duration={duration_ms/1000:.1f}s"
                  f"  interval={step_ms:.0f}ms  frames_to_process={total_to_process}"
                  f"  vote_threshold={vote_threshold}")

            yield _sse({
                "type": "init",
                "total_frames": total_to_process,
                "source_fps": round(source_fps, 2),
                "interval_ms": step_ms,
                "vote_threshold": vote_threshold,
            })

            vote_manager    = VoteManager(threshold=vote_threshold)
            processed_count = 0

            for idx, seek_ms in enumerate(timestamps):
                cap.set(cv2.CAP_PROP_POS_MSEC, seek_ms)
                ret, frame = cap.read()
                if not ret:
                    continue

                processed_count += 1

                # ── Cropped OCR pipeline ──────────────────────────────────────
                ocr_results, candidates, best, source, yolo_boxes, annotated_frame = process_ocr_pipeline(frame)

                if candidates:
                    vote_manager.add_candidates(candidates)

                # ── Thumbnail (320x180 JPEG, base64) generated from annotated_frame ──
                thumb    = cv2.resize(annotated_frame, (320, 180))
                _, buf   = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 55])
                thumb_b64 = base64.b64encode(buf).decode()

                if candidates:
                    print(f"[OCR-STREAM] [{processed_count}/{total_to_process}]"
                          f"  t={seek_ms/1000:.2f}s  candidates={candidates} (source: {source})"
                          f"  votes={dict(vote_manager.counter)}")
                elif processed_count % 10 == 0:
                    print(f"[OCR-STREAM] [{processed_count}/{total_to_process}]"
                          f"  t={seek_ms/1000:.2f}s  no match")

                yield _sse({
                    "type": "frame",
                    "frame": processed_count,
                    "processed": processed_count,
                    "total": total_to_process,
                    "progress": round((idx + 1) / total_to_process * 100, 1),
                    "timestamp_ms": round(seek_ms, 1),
                    "candidates": candidates,
                    "votes": vote_manager.get_all_votes(),
                    "thumbnail": thumb_b64,
                    "ocr_texts": [{"text": d["text"], "confidence": round(d["confidence"], 3)}
                                  for d in ocr_results],
                })

            cap.release()
            cap = None

            best = vote_manager.get_best_candidate()
            print(f"[OCR-STREAM] DONE  best={best}  votes={vote_manager.get_all_votes()}"
                  f"  processed={processed_count}/{total_to_process}")

            yield _sse({
                "type": "done",
                "best": best,
                "votes": vote_manager.get_all_votes(),
                "frames_read": total_to_process,
                "frames_processed": processed_count,
            })

        except Exception as exc:
            print(f"[OCR-STREAM] ERROR: {exc}")
            yield _sse({"type": "error", "message": str(exc)})

        finally:
            if cap is not None:
                cap.release()
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    return app.response_class(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 55)
    print("  Train Number OCR Server (YOLO-Crop HTTP Client)")
    print("  Loading PaddleOCR models (one-time, ~5s)...")
    print("=" * 55)

    # Warmup — forces PaddleOCR model load before first request
    import numpy as np
    _blank_ocr = np.zeros((100, 300, 3), dtype="uint8")
    run_ocr(_blank_ocr)

    print("  Models warmed up.")
    print("  Server ready at http://localhost:5000")
    print("=" * 55 + "\n")

    app.run(host="0.0.0.0", port=5000, debug=False)
