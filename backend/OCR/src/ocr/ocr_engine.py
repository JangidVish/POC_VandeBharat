import os
import cv2
import easyocr

# EasyOCR reader — initialized once, reused globally
_reader = None


def get_ocr():
    global _reader
    if _reader is not None:
        return _reader

    gpu = os.environ.get("OCR_DEVICE", "cpu").strip().lower() != "cpu"
    print(f"[OCR][ENGINE_INIT] Initializing EasyOCR (gpu={gpu})")
    _reader = easyocr.Reader(["en"], gpu=gpu)
    print(f"[OCR][ENGINE_READY] EasyOCR initialized")
    return _reader


def run_ocr(image):
    """
    Runs EasyOCR on a single image (numpy array).
    Returns list of {text, confidence} dicts.
    """
    # EasyOCR accepts BGR or grayscale
    if len(image.shape) == 3 and image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)

    reader = get_ocr()
    print(f"[OCR][ENGINE_START] Processing image shape={image.shape}")

    try:
        results = reader.readtext(image, detail=1)
        extracted = []
        for bbox, text, confidence in results:
            extracted.append({
                "text": str(text).strip(),
                "confidence": float(confidence)
            })

        print(f"[OCR][ENGINE_DONE] detections={len(extracted)} sample={extracted[:3]}")
        return extracted
    except Exception as e:
        print(f"[OCR][ENGINE_ERR] {str(e)}")
        return []
