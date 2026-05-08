import cv2
import easyocr

_reader = easyocr.Reader(['en'], gpu=False, verbose=False)


def run_ocr(image):
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    results = _reader.readtext(image, detail=1)

    extracted = []
    for (_, text, confidence) in results:
        extracted.append({
            "text": text.strip(),
            "confidence": confidence,
        })

    return extracted
