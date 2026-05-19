import os
import sys

# Support loading CUDA/cuDNN DLLs dynamically on Windows from nvidia python packages if installed
if sys.platform == "win32":
    for pkg in ["nvidia.cudnn", "nvidia.cublas", "nvidia.cuda_runtime", "nvidia.cusparse"]:
        try:
            mod = __import__(pkg, fromlist=["__file__"])
            pkg_bin = os.path.abspath(os.path.join(os.path.dirname(mod.__file__), "bin"))
            if os.path.exists(pkg_bin):
                print(f"[OCR] Found {pkg} at {pkg_bin}. Adding to DLL search path...")
                os.add_dll_directory(pkg_bin)
        except Exception as e:
            pass

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
    if not result:
        return extracted

    # Format 1: New PaddleX/PaddleOCR v3.0+ Dictionary format
    # Example: [{'rec_texts': ['14630'], 'rec_scores': [0.999], 'rec_polys': [array(...)]}]
    if isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict):
        data = result[0]
        rec_texts = data.get("rec_texts", [])
        rec_scores = data.get("rec_scores", [])
        rec_polys = data.get("rec_polys", [])
        
        # Fallback to rec_boxes if rec_polys is empty
        if not rec_polys and "rec_boxes" in data:
            rec_polys = data["rec_boxes"]
            
        for i in range(len(rec_texts)):
            text = rec_texts[i]
            score = rec_scores[i] if i < len(rec_scores) else 1.0
            
            # Extract box coordinates (convert numpy arrays/tensors to standard lists)
            box = None
            if i < len(rec_polys):
                poly = rec_polys[i]
                if hasattr(poly, "tolist"):
                    box = poly.tolist()
                elif isinstance(poly, list):
                    box = poly
                    
            extracted.append({
                "text": str(text).strip(),
                "confidence": float(score),
                "box": box
            })
            
        return extracted

    # Format 2: Classic PaddleOCR Nested List format
    # Example: [[ [[coords], ('text', conf)], ... ]]
    if result[0] is None:
        return extracted

    for res in result[0]:
        if len(res) > 1 and isinstance(res[1], tuple):
            text, score = res[1]
            extracted.append({
                "text": str(text).strip(),
                "confidence": float(score),
                "box": res[0]
            })

    return extracted
