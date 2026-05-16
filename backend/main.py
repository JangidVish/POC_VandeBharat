"""
FastAPI backend — streams detection results to React UI via WebSocket.

Run:
    uvicorn main:app --reload --port 8000

Config via env vars:
    VIDEO_SOURCE — path to video file, or 0 for live camera
    USE_STUB     — "true" to use fake detections (no YOLO service needed)
"""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime

import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from inference import InferenceEngine
from video_processor import VideoProcessor

# ─── CONFIG ──────────────────────────────────────────────────────────────────
VIDEO_SOURCE = os.environ.get("VIDEO_SOURCE", "../ui/public/Video_2.mp4")
TARGET_FPS   = int(os.environ.get("TARGET_FPS", "5"))
# Default to FALSE to ensure we connect to actual model as requested
USE_STUB     = os.environ.get("USE_STUB", "false").lower() == "true"
# ─────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[Startup] Initializing InferenceEngine (mode: {'STUB' if USE_STUB else 'MODEL'})")
    app.state.engine = InferenceEngine(use_stub=USE_STUB)
    yield
    print("[Shutdown] Releasing resources")


app = FastAPI(title="Vande Bharat AI Inspection Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def px_to_pct(bbox_px: list[int], frame_w: int, frame_h: int) -> list[float]:
    """Convert [x, y, w, h] pixels → [x, y, w, h] fractions (0.0–1.0)."""
    x, y, w, h = bbox_px
    return [
        round(x / frame_w, 4),
        round(y / frame_h, 4),
        round(w / frame_w, 4),
        round(h / frame_h, 4),
    ]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "stub" if USE_STUB else "yolo-service",
        "yolo_service": "http://127.0.0.1:5002",
        "video_source": str(VIDEO_SOURCE),
    }


@app.websocket("/ws/detections")
async def stream_detections(ws: WebSocket):
    await ws.accept()
    print(f"[WS] Client connected: {ws.client}")

    engine: InferenceEngine = ws.app.state.engine
    video = VideoProcessor(VIDEO_SOURCE, target_fps=TARGET_FPS)

    try:
        video.open()
    except RuntimeError as e:
        await ws.send_text(json.dumps({"error": str(e)}))
        await ws.close()
        return

    frame_count = 0
    fps_counter = 0
    fps_ts = time.time()
    current_fps = 0

    try:
        while True:
            t0 = time.time()

            frame = video.read_frame()
            if frame is None:
                await asyncio.sleep(0.1)
                continue

            h, w = frame.shape[:2]
            raw_detections = engine.predict(frame)

            # Convert pixel bbox → percentage bbox for frontend
            detections = []
            for det in raw_detections:
                d = det.copy()
                d["bbox"] = px_to_pct(d.pop("bbox_px"), w, h)
                detections.append(d)

            # FPS calculation
            fps_counter += 1
            now = time.time()
            if now - fps_ts >= 1.0:
                current_fps = fps_counter
                fps_counter = 0
                fps_ts = now

            payload = {
                "detections": detections,
                "detected_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "meta": {
                    "frame": frame_count,
                    "fps": current_fps,
                    "latency_ms": round((time.time() - t0) * 1000),
                    "mode": "stub" if USE_STUB else "model",
                }
            }

            await ws.send_text(json.dumps(payload))
            frame_count += 1

            # Pace to target FPS
            elapsed = time.time() - t0
            sleep_time = video.frame_interval - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {ws.client}")
    except Exception as e:
        print(f"[WS] Error: {e}")
    finally:
        video.release()
