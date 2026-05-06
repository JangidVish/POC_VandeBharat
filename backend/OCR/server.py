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
