"""
FastAPI backend — streams detection results to React UI via WebSocket.

Run:
    uvicorn main:app --reload --port 8000

Config (top of file):
    MODEL_PATH  — path to your .pt file, or None to use stub mode
    VIDEO_SOURCE — path to video file, or 0 for live camera
    USE_STUB    — True = no model needed (for UI testing)
"""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from inference import InferenceEngine
from video_processor import VideoProcessor

# ─── CONFIG ──────────────────────────────────────────────────────────────────
MODEL_PATH   = os.environ.get("MODEL_PATH",   "models/best.pt")
VIDEO_SOURCE = os.environ.get("VIDEO_SOURCE", "../ui/public/Video_2.mp4")
TARGET_FPS   = int(os.environ.get("TARGET_FPS", "25"))
USE_STUB     = os.environ.get("USE_STUB", "false").lower() == "true"

# Auto-fallback to stub if model file doesn't exist
if not USE_STUB and not os.path.exists(MODEL_PATH):
    print(f"[WARNING] Model not found at '{MODEL_PATH}' — falling back to STUB mode")
    USE_STUB = True
# ─────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = InferenceEngine(
        model_path=MODEL_PATH if not USE_STUB else None,
        use_stub=USE_STUB,
    )
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
        "mode": "stub" if USE_STUB else "model",
        "model_path": MODEL_PATH,
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
