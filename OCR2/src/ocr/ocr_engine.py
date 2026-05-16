import os

import cv2
from paddleocr import PaddleOCR

# PaddleOCR 3.x API:
#   device='gpu'                         — CUDA inference
#   use_textline_orientation=True        — handles rotated/angled train numbers
#   use_doc_orientation_classify=False   — skip doc-rotation model (useless for train images)
#   use_doc_unwarping=False              — skip document unwarping model (useless for train images)
#   lang='en'                            — targets English/numeric characters
_ocr = None
_ocr_device = None


def _create_ocr(device: str):
    print(f"[OCR][ENGINE_INIT] device={device}")
    return PaddleOCR(
        use_angle_cls=True,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        lang="en",
        device=device,
    )


def get_ocr():
    global _ocr, _ocr_device
    if _ocr is not None:
        return _ocr

    preferred = os.environ.get("OCR_DEVICE", "gpu").strip().lower()
    devices = [preferred]
    if preferred != "cpu":
        devices.append("cpu")

    last_error = None
    for device in devices:
        try:
            _ocr = _create_ocr(device)
            _ocr_device = device
            print(f"[OCR][ENGINE_READY] device={device}")
            return _ocr
        except Exception as exc:
            last_error = exc
            print(f"[OCR][ENGINE_INIT_FAIL] device={device} error={exc}")

    raise RuntimeError(f"Failed to initialize PaddleOCR: {last_error}")


def run_ocr(image):
    # PaddleOCR 3.x requires a 3-channel image
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    ocr = get_ocr()
    print(f"[OCR][ENGINE_START] device={_ocr_device} shape={image.shape}")
    result = ocr.ocr(image)
    print(f"[OCR][ENGINE_RAW] type={type(result).__name__}")

    extracted = []
    if not result or result[0] is None:
        return extracted

    # Standard PaddleOCR output is a list of lists: [[[bbox], (text, score)], ...]
    # Sometimes it's a dict depending on the engine/version
    res = result[0]
    
    if isinstance(res, list):
        for line in res:
            # line is [[bbox], (text, score)]
            if len(line) > 1 and isinstance(line[1], tuple):
                text, score = line[1]
                extracted.append({
                    "text": str(text),
                    "confidence": float(score)
                })
    elif isinstance(res, dict):
        texts = res.get("rec_texts", [])
        scores = res.get("rec_scores", [])
        for text, confidence in zip(texts, scores):
            extracted.append({
                "text": str(text),
                "confidence": float(confidence)
            })

    print(f"[OCR][ENGINE_DONE] detections={len(extracted)} sample={extracted[:3]}")
    return extracted
