import os
import cv2
import easyocr

# Global OCR instance
_ocr = None
_ocr_device = None

def get_ocr():
    """
    Returns (or initializes) the EasyOCR reader.
    Automatically detects and uses GPU if available.
    """
    global _ocr, _ocr_device
    if _ocr is not None:
        return _ocr

    # Detect preferred device
    preferred = os.environ.get("OCR_DEVICE", "gpu").strip().lower()
    use_gpu = (preferred == "gpu")
    
    print(f"[OCR][ENGINE_INIT] Initializing EasyOCR (gpu={use_gpu})")
    
    try:
        # Initialize EasyOCR for English and Numbers
        _ocr = easyocr.Reader(['en'], gpu=use_gpu)
        _ocr_device = "gpu" if use_gpu else "cpu"
        print(f"[OCR][ENGINE_READY] EasyOCR initialized on {_ocr_device}")
    except Exception as e:
        print(f"[OCR][ENGINE_INIT_FAIL] GPU initialization failed: {e}")
        print("[OCR][ENGINE_RETRY] Falling back to CPU...")
        _ocr = easyocr.Reader(['en'], gpu=False)
        _ocr_device = "cpu"
        print("[OCR][ENGINE_READY] EasyOCR initialized on cpu")

    return _ocr

def run_ocr(image):
    """
    Runs EasyOCR on a single image (numpy array).
    Returns list of dicts: {"text": str, "confidence": float}
    """
    reader = get_ocr()
    if reader is None:
        return []

    # EasyOCR expects RGB images
    if len(image.shape) == 3 and image.shape[2] == 3:
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    else:
        image_rgb = image

    print(f"[OCR][ENGINE_START] Processing image shape={image.shape}")
    
    # Run inference
    # detail=0 returns only the text, but we want confidence
    results = reader.readtext(image_rgb)
    
    extracted = []
    for (bbox, text, prob) in results:
        extracted.append({
            "text": str(text).strip(),
            "confidence": float(prob)
        })

    print(f"[OCR][ENGINE_DONE] detections={len(extracted)} sample={extracted[:3]}")
    return extracted
