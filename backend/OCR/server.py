"""
Train Number OCR Server
Loads PaddleOCR models ONCE at startup — all subsequent requests are fast.

Run from POC/backend/OCR/:
    python server.py
"""

import os
import sys
import uuid
import tempfile
import json
import base64

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


# ── Routes ────────────────────────────────────────────────────────────────────

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

        processed = preprocess_frame(frame)
        ocr_results = run_ocr(processed)
        candidates = filter_train_numbers(ocr_results)

        return jsonify({
            "detections": ocr_results,
            "train_number_candidates": candidates,
            "best": candidates[0] if candidates else None,
        })
    finally:
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
            processed = preprocess_frame(frame)
            ocr_results = run_ocr(processed)
            candidates = filter_train_numbers(ocr_results)

            if candidates:
                vote_manager.add_candidates(candidates)
                detection_log.append({"frame": frame_count, "candidates": candidates})

        best = vote_manager.get_best_candidate()

        return jsonify({
            "best": best,
            "votes": vote_manager.get_all_votes(),
            "frames_read": frame_count,
            "frames_processed": processed_count,
            "detection_log": detection_log,
        })
    finally:
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

            # Build the exact list of timestamps to seek — mirrors Stage 1 logic
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
                "total_frames": total_to_process,   # what the user cares about
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

                # ── OCR pipeline ──────────────────────────────────────────────
                preprocessed = preprocess_frame(frame)
                ocr_results  = run_ocr(preprocessed)
                candidates   = filter_train_numbers(ocr_results)

                if candidates:
                    vote_manager.add_candidates(candidates)

                # ── Thumbnail (160x90 JPEG, base64) ───────────────────────────
                thumb    = cv2.resize(frame, (160, 90))
                _, buf   = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 55])
                thumb_b64 = base64.b64encode(buf).decode()

                if candidates:
                    print(f"[OCR-STREAM] [{processed_count}/{total_to_process}]"
                          f"  t={seek_ms/1000:.2f}s  candidates={candidates}"
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
    print("  Train Number OCR Server")
    print("  Loading models (one-time, ~5s)...")
    print("=" * 55)

    # Warmup — forces model load before first request
    import numpy as np
    _blank = np.zeros((100, 300, 3), dtype="uint8")
    run_ocr(_blank)

    print("  Models warmed up.")
    print("  Server ready at http://localhost:5000")
    print("=" * 55 + "\n")

    app.run(host="0.0.0.0", port=5000, debug=False)
