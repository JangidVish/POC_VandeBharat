# OCR Pipeline — Setup & Usage

## 1. Create Virtual Environment

```bash
cd OCR
python -m venv venv
venv\Scripts\activate
```

## 2. Install GPU PaddlePaddle

Install the CUDA 11.8 version (adjust if your CUDA version differs):

```bash
pip install paddlepaddle-gpu==2.6.1.post118 -f https://www.paddlepaddle.org.cn/whl/windows/mkl/avx/stable.html
```

Check your CUDA version first:
```bash
nvidia-smi
```

## 3. Install Remaining Dependencies

```bash
pip install paddleocr opencv-python numpy
```

## 4. Verify Setup

```bash
python test_ocr.py
```

Expected output:
```
Loading PaddleOCR (GPU)...
PaddleOCR loaded successfully on GPU.
```

## 5. Test on a Still Image (no video needed)

```bash
python test_on_image.py "../Combine Dataset/dataset/train/images/GX010973_idx00195_png.rf.rZXewjP292YLAnDBbTjG.png"
```

Add `--save-preprocessed` to also save what the OCR engine sees.

## 6. Run Full Video Pipeline

```bash
python main.py data/videos/train.mp4
```

Options:
```
--skip 5        Process every 5th frame (default: 5)
--votes 5       Minimum detections to confirm train number (default: 5)
--verbose       Print every candidate detected per frame
```

Example:
```bash
python main.py data/videos/train.mp4 --skip 3 --verbose
```

## File Structure

```
OCR/
├── src/
│   ├── capture/video_reader.py         # Video frame generator
│   ├── preprocess/preprocess.py        # Grayscale, resize, sharpen, CLAHE, blur
│   ├── ocr/ocr_engine.py               # PaddleOCR wrapper (GPU)
│   ├── filtering/train_number_filter.py # 5-digit regex + confidence filter
│   └── voting/vote_manager.py          # Temporal voting
├── data/videos/                        # Put your .mp4 files here
├── main.py                             # Full video pipeline
├── test_ocr.py                         # Verify PaddleOCR loads
└── test_on_image.py                    # Test OCR on a single image
```
