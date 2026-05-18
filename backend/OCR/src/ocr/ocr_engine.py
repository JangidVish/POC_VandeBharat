import os
import cv2
from paddleocr import PaddleOCR

# PaddleOCR configuration
_ocr = None

def get_ocr():
    global _ocr
    if _ocr is not None:
        return _ocr

    # Prioritize GPU
    device = os.environ.get("OCR_DEVICE", "gpu").strip().lower()
    
    try:
        print(f"[OCR][ENGINE_INIT] Initializing PaddleOCR on {device}...")
        # We disable doc orientation and unwarping to avoid the crashing PaddleX pipeline
        _ocr = PaddleOCR(
            use_angle_cls=True,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            lang="en",
            device=device
        )
        print(f"[OCR][ENGINE_READY] PaddleOCR initialized on {device}.")
        return _ocr
    except Exception as exc:
        print(f"[OCR][ENGINE_INIT_FAIL] device={device} error={exc}")
        if device == "gpu":
            print("[OCR][RETRY] Falling back to cpu...")
            _ocr = PaddleOCR(
                use_angle_cls=True,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                lang="en",
                device="cpu"
            )
            return _ocr
        raise exc

def run_ocr(image):
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    ocr_engine = get_ocr()
    result = ocr_engine.ocr(image)
    
    extracted = []
    if not result or result[0] is None:
        return extracted

    for res in result[0]:
        if len(res) > 1 and isinstance(res[1], tuple):
            text, score = res[1]
            extracted.append({
                "text": str(text).strip(),
                "confidence": float(score),
            })

    return extracted
