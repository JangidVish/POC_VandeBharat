import cv2
from paddleocr import PaddleOCR

# PaddleOCR 3.x API:
#   device='gpu'                         — CUDA inference
#   use_textline_orientation=True        — handles rotated/angled train numbers
#   use_doc_orientation_classify=False   — skip doc-rotation model (useless for train images)
#   use_doc_unwarping=False              — skip document unwarping model (useless for train images)
#   lang='en'                            — targets English/numeric characters
_ocr = PaddleOCR(
    use_textline_orientation=True,
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    lang='en',
    device='gpu',
)


def run_ocr(image):
    # PaddleOCR 3.x requires a 3-channel image; preprocessor returns grayscale
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    result = _ocr.ocr(image)

    extracted = []

    if not result or result[0] is None:
        return extracted

    # PaddleOCR 3.x returns a dict with rec_texts / rec_scores lists
    res = result[0]
    texts = res.get("rec_texts", [])
    scores = res.get("rec_scores", [])

    for text, confidence in zip(texts, scores):
        extracted.append({
            "text": text,
            "confidence": confidence
        })

    return extracted
