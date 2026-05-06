"""
Frame extraction from video file or live camera.
Handles looping, resize, and frame skipping for target FPS.
"""

import cv2
import time
import numpy as np


class VideoProcessor:
    def __init__(self, source: str | int, target_fps: int = 25, width: int = 1280, height: int = 720):
        self.source = source
        self.target_fps = target_fps
        self.width = width
        self.height = height
        self.cap = None
        self._frame_interval = 1.0 / target_fps

    def open(self):
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open video source: {self.source}")

        source_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
        self._skip = max(1, int(source_fps / self.target_fps))
        print(f"[VideoProcessor] Opened: {self.source} | source_fps={source_fps:.1f} | skip={self._skip}")

    def read_frame(self) -> np.ndarray | None:
        if self.cap is None:
            return None

        # Skip frames to match target FPS
        for _ in range(self._skip - 1):
            self.cap.grab()

        ret, frame = self.cap.read()
        if not ret:
            # Loop video file
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self.cap.read()
            if not ret:
                return None

        return cv2.resize(frame, (self.width, self.height))

    def release(self):
        if self.cap:
            self.cap.release()
            self.cap = None

    @property
    def frame_interval(self) -> float:
        return self._frame_interval
