import re

# Indian train numbers are exactly 5 digits
TRAIN_PATTERN = re.compile(r"^\d{5}$")

# Minimum OCR confidence to accept a candidate
CONFIDENCE_THRESHOLD = 0.85


def filter_train_numbers(ocr_results):
    candidates = []

    for item in ocr_results:
        text = item["text"]
        confidence = item["confidence"]

        # Strip spaces that PaddleOCR sometimes inserts mid-number
        cleaned = text.replace(" ", "").strip()

        if TRAIN_PATTERN.match(cleaned) and confidence >= CONFIDENCE_THRESHOLD:
            candidates.append(cleaned)

    return candidates
