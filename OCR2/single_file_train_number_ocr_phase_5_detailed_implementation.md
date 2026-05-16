# Train Number OCR Pipeline — Complete Detailed Implementation (Phase 1 to Phase 5)

# Project Objective

Build a fully local/offline OCR pipeline capable of:

- Reading train coach side-view videos
- Detecting text from moving trains
- Extracting only the train number
- Running efficiently on local hardware
- Avoiding cloud APIs and external AI services
- Providing fast and deterministic output

This document covers the complete implementation from:

```txt
Video Input
    ↓
Frame Processing
    ↓
OCR
    ↓
Regex Filtering
    ↓
Temporal Voting
```

This implementation intentionally DOES NOT include ROI detection yet.
ROI detection will be added later after the base OCR pipeline becomes stable.

---

# Why We Are Starting Without ROI Detection

The goal initially is:

1. Validate OCR quality
2. Understand train-number visibility
3. Tune preprocessing
4. Build stable text extraction
5. Measure real-world OCR noise
6. Establish baseline performance

Adding ROI detection too early increases complexity:

- data annotation required
- YOLO training required
- debugging becomes harder
- more moving parts

So the correct engineering flow is:

```txt
Base OCR Pipeline
      ↓
Stable Detection
      ↓
Performance Analysis
      ↓
ROI Detection
      ↓
Optimization
```

---

# What Is OCR?

OCR = Optical Character Recognition

OCR converts image text into machine-readable text.

Example:

Input image:

```txt
12841
```

OCR output:

```python
"12841"
```

---

# How OCR Works Internally

OCR systems usually contain 3 stages:

---

# Stage 1 — Text Detection

The OCR engine first detects regions containing text.

Example:

```txt
[ WINDOW ]
[ 12841 ]
[ S5 ]
```

It finds:

- where text exists
- bounding boxes of text

---

# Stage 2 — Text Orientation Correction

The OCR engine checks:

- rotated text
- angled text
- perspective distortions

This is important because train numbers may not always appear perfectly horizontal.

---

# Stage 3 — Character Recognition

The detected text region is passed through a recognition model.

Example:

Image:

```txt
12841
```

Model Output:

```python
"12841"
```

---

# OCR Engine We Are Using

# PaddleOCR

Why PaddleOCR:

| Feature | Benefit |
|---|---|
| Fast | Suitable for real-time |
| GPU support | Scalable |
| Robust detection | Good for industrial scenes |
| Angle correction | Important for moving trains |
| Local inference | No cloud needed |
| Production-ready | Widely used |

---

# Does PaddleOCR Need a Separate Service?

NO.

PaddleOCR is NOT:

- a separate server
- an API process
- an Ollama-style service
- a cloud application

It works as:

```txt
Python Application
        ↓
PaddleOCR Library
        ↓
OCR Models Loaded Into RAM/VRAM
        ↓
Inference Happens Inside Python Process
```

---

# Comparison With Ollama

| Feature | PaddleOCR | Ollama |
|---|---|---|
| Separate service needed | No | Yes |
| Runs inside Python app | Yes | No |
| API-based | No | Yes |
| Lightweight | Yes | No |
| OCR-specific | Yes | No |
| Easy local integration | Yes | Medium |

---

# Final Architecture (Current Implementation)

```txt
Video / Camera Feed
        ↓
Frame Extraction
        ↓
Frame Skipping
        ↓
Image Preprocessing
        ↓
PaddleOCR
        ↓
Regex Filtering
        ↓
Confidence Filtering
        ↓
Temporal Voting
        ↓
Final Stable Train Number
```

---

# Technology Stack

| Component | Technology |
|---|---|
| Language | Python |
| OCR | PaddleOCR |
| Video Processing | OpenCV |
| Regex Filtering | Python re |
| Voting Logic | collections |
| Future Detection | YOLOv8 |

---

# Recommended Hardware

# Minimum

- 8GB RAM
- Quad-core CPU

---

# Recommended

- NVIDIA GPU
- CUDA support
- RTX 3050 or better

---

# Edge Deployment

- Jetson Nano
- Jetson Orin Nano

---

# Folder Structure

```txt
train-number-ocr/
│
├── data/
│   ├── videos/
│   ├── frames/
│   ├── outputs/
│   └── train_db/
│
├── src/
│   ├── capture/
│   ├── preprocess/
│   ├── ocr/
│   ├── filtering/
│   ├── voting/
│   └── utils/
│
├── requirements.txt
├── main.py
└── README.md
```

---

# PHASE 1 — Environment Setup

# Step 1 — Create Virtual Environment

## Windows

```bash
python -m venv venv
venv\Scripts\activate
```

---

## Linux/macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

# Step 2 — Install Dependencies

## CPU Version

```bash
pip install paddleocr
pip install paddlepaddle
pip install opencv-python
pip install ultralytics
pip install numpy
```

---

# GPU Version (Future Optimization)

Install CUDA-supported PaddlePaddle.

Reference:

https://www.paddlepaddle.org.cn/install/quick

---

# Step 3 — Verify OCR Installation

Create:

```txt
test_ocr.py
```

Code:

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True)

print("OCR Loaded Successfully")
```

Run:

```bash
python test_ocr.py
```

---

# PHASE 2 — Video Input Pipeline

# Goal

Efficiently read video frames.

---

# Create Video Reader

File:

```txt
src/capture/video_reader.py
```

Code:

```python
import cv2


def read_video(video_path):

    cap = cv2.VideoCapture(video_path)

    while True:

        ret, frame = cap.read()

        if not ret:
            break

        yield frame

    cap.release()
```

---

# Test Frame Reading

```python
from src.capture.video_reader import read_video
import cv2

for frame in read_video("data/videos/train.mp4"):

    cv2.imshow("Frame", frame)

    if cv2.waitKey(1) == ord('q'):
        break
```

---

# PHASE 3 — Frame Skipping

# Why Frame Skipping Is Important

OCR is computationally expensive.

Example:

```txt
30 FPS Video
        ↓
Process Every 5th Frame
        ↓
Effective OCR FPS = 6
```

This is usually enough for moving trains.

---

# Benefits

| Benefit | Explanation |
|---|---|
| Lower CPU/GPU usage | Fewer OCR calls |
| Faster pipeline | Less inference load |
| Better scalability | Easier multi-camera support |
| Lower latency | Faster processing |

---

# Implementation

```python
frame_count = 0

for frame in read_video(video_path):

    frame_count += 1

    if frame_count % 5 != 0:
        continue

    process_frame(frame)
```

---

# PHASE 4 — Image Preprocessing

# Why Preprocessing Matters

OCR quality depends heavily on image quality.

Problems caused by moving trains:

- motion blur
- low contrast
- small text
- noisy backgrounds
- poor lighting

Preprocessing improves OCR readability.

---

# Preprocessing Pipeline

```txt
Frame
  ↓
Grayscale
  ↓
Resize
  ↓
Sharpen
  ↓
Contrast Enhancement
  ↓
Noise Reduction
```

---

# Step 1 — Convert to Grayscale

```python
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
```

Reason:

- reduces computation
- removes unnecessary color information
- improves OCR consistency

---

# Step 2 — Resize

```python
gray = cv2.resize(gray, None, fx=2, fy=2)
```

Reason:

- train numbers may appear small
- OCR performs better on larger text

---

# Step 3 — Sharpening

```python
import numpy as np

kernel = np.array([
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0]
])

sharp = cv2.filter2D(gray, -1, kernel)
```

Reason:

- improves edge clarity
- enhances character boundaries

---

# Step 4 — Contrast Enhancement

```python
clahe = cv2.createCLAHE(clipLimit=2.0)

enhanced = clahe.apply(sharp)
```

Reason:

- improves visibility under uneven lighting
- enhances faded train numbers

---

# Step 5 — Noise Reduction

```python
denoised = cv2.GaussianBlur(enhanced, (3, 3), 0)
```

Reason:

- reduces OCR confusion
- smooths random artifacts

---

# Final Preprocess Function

File:

```txt
src/preprocess/preprocess.py
```

Code:

```python
import cv2
import numpy as np


def preprocess_frame(frame):

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    gray = cv2.resize(gray, None, fx=2, fy=2)

    kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ])

    sharp = cv2.filter2D(gray, -1, kernel)

    clahe = cv2.createCLAHE(clipLimit=2.0)

    enhanced = clahe.apply(sharp)

    denoised = cv2.GaussianBlur(enhanced, (3, 3), 0)

    return denoised
```

---

# PHASE 5 — OCR Integration

# Goal

Extract text from processed frames.

---

# Create OCR Module

File:

```txt
src/ocr/ocr_engine.py
```

---

# Initialize PaddleOCR

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True)
```

---

# What Happens Internally?

When initialized:

```python
ocr = PaddleOCR()
```

PaddleOCR:

1. Loads OCR models into RAM/VRAM
2. Initializes text detector
3. Initializes text recognizer
4. Initializes angle classifier
5. Prepares inference runtime

This happens locally.

No cloud API is used.

---

# OCR Inference Function

```python
def run_ocr(image):

    result = ocr.ocr(image)

    extracted = []

    if result[0] is None:
        return extracted

    for line in result[0]:

        text = line[1][0]
        confidence = line[1][1]

        extracted.append({
            "text": text,
            "confidence": confidence
        })

    return extracted
```

---

# Example OCR Output

```python
[
    {
        "text": "12841",
        "confidence": 0.98
    },
    {
        "text": "S5",
        "confidence": 0.92
    },
    {
        "text": "INDIAN RAILWAYS",
        "confidence": 0.95
    }
]
```

---

# Regex Filtering

# Goal

Extract only train-number candidates.

---

# Why Regex Works Here

Indian train numbers follow a structured pattern:

- usually 5 digits
- numeric only

This makes regex filtering extremely effective.

No LLM is required.

---

# Filtering Module

File:

```txt
src/filtering/train_number_filter.py
```

Code:

```python
import re


TRAIN_PATTERN = r"\d{5}"


def filter_train_numbers(ocr_results):

    candidates = []

    for item in ocr_results:

        text = item["text"]
        confidence = item["confidence"]

        cleaned = text.replace(" ", "")

        if re.fullmatch(TRAIN_PATTERN, cleaned):

            if confidence > 0.85:

                candidates.append(cleaned)

    return candidates
```

---

# Why Confidence Filtering Matters

OCR mistakes happen.

Example:

```txt
1284I
```

may get low confidence.

Confidence filtering removes weak predictions.

---

# PHASE 5 — Temporal Voting

# Why Temporal Voting Is Necessary

OCR fluctuates across frames.

Example:

Frame 1:

```txt
1284I
```

Frame 2:

```txt
12841
```

Frame 3:

```txt
12841
```

Frame 4:

```txt
I2841
```

Instead of trusting one frame:

We trust repeated detections.

---

# Voting Strategy

```txt
Repeated Detection = Higher Confidence
```

---

# Voting Module

File:

```txt
src/voting/vote_manager.py
```

Code:

```python
from collections import defaultdict


class VoteManager:

    def __init__(self):
        self.counter = defaultdict(int)

    def add_candidates(self, candidates):

        for candidate in candidates:
            self.counter[candidate] += 1

    def get_best_candidate(self):

        if not self.counter:
            return None

        best = max(self.counter, key=self.counter.get)

        if self.counter[best] >= 5:
            return best

        return None
```

---

# Why Threshold = 5?

This means:

```txt
Train number must appear in at least 5 frames
before being accepted.
```

This dramatically reduces false positives.

---

# Main Pipeline

File:

```txt
main.py
```

Code:

```python
from src.capture.video_reader import read_video
from src.preprocess.preprocess import preprocess_frame
from src.ocr.ocr_engine import run_ocr
from src.filtering.train_number_filter import filter_train_numbers
from src.voting.vote_manager import VoteManager


video_path = "data/videos/train.mp4"

vote_manager = VoteManager()

frame_count = 0


for frame in read_video(video_path):

    frame_count += 1

    if frame_count % 5 != 0:
        continue

    processed = preprocess_frame(frame)

    ocr_results = run_ocr(processed)

    candidates = filter_train_numbers(ocr_results)

    vote_manager.add_candidates(candidates)

    best = vote_manager.get_best_candidate()

    if best:
        print(f"Detected Train Number: {best}")
```

---

# Expected Initial Performance

| Stage | Accuracy |
|---|---|
| Raw OCR | 80–90% |
| + Preprocessing | 88–94% |
| + Regex | 92–96% |
| + Voting | 96–99% |

---

# Problems Expected Initially

You may still face:

- false text detections
- station board interference
- blurred frames
- low-light OCR failures
- perspective distortion
- small train numbers

These are expected.

This is why ROI detection will be added later.

---

# What We Will Add Later (Future Phases)

# 1. ROI Detection

ROI = Region Of Interest

Goal:

Detect only the train-number area.

Instead of OCR on full frame:

```txt
Whole Train
```

we OCR only:

```txt
Train Number Region
```

---

# Why ROI Detection Will Help

Without ROI:

OCR sees:

- windows
- stickers
- coach labels
- advertisements
- passengers
- station text

With ROI:

OCR sees mostly:

```txt
12841
```

This improves:

| Improvement | Benefit |
|---|---|
| Speed | Smaller OCR area |
| Accuracy | Less noise |
| Stability | Better consistency |
| Lower false positives | Cleaner OCR |

---

# ROI Detection Technology

We will later use:

```txt
YOLOv8
```

for detecting:

```txt
train_number_region
```

---

# Future Pipeline

```txt
Video
   ↓
YOLO ROI Detection
   ↓
Crop ROI
   ↓
OCR
   ↓
Regex
   ↓
Voting
```

---

# Future Optimizations

Later we may also add:

- TensorRT acceleration
- ONNX export
- GPU optimization
- multi-camera support
- live RTSP streaming
- train database validation
- motion blur correction
- night mode enhancement
- object tracking
- asynchronous OCR workers

---

# Recommended Development Flow

# Step 1

Implement base OCR pipeline.

---

# Step 2

Test on train images.

---

# Step 3

Test on train videos.

---

# Step 4

Tune preprocessing.

---

# Step 5

Analyze OCR failure patterns.

---

# Step 6

Move to ROI detection.

---

# Final Recommendation

DO NOT optimize too early.

First build:

```txt
Stable OCR + Regex + Voting Pipeline
```

Then add:

```txt
ROI Detection
```

This is the correct industrial development approach.

