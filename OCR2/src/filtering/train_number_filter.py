import re

# Indian train numbers are 5 or 6 digits
TRAIN_PATTERN = re.compile(r"^\d{5,6}$")

# Minimum OCR confidence to accept a candidate
CONFIDENCE_THRESHOLD = 0.50


def filter_train_numbers(ocr_results):
    candidates = []

    for item in ocr_results:
        text = item["text"]
        confidence = item["confidence"]

        # Extract only digits from the text
        cleaned = "".join(re.findall(r"\d+", text))

        # Indian train numbers are usually 5 digits, sometimes 6
        if len(cleaned) >= 5 and len(cleaned) <= 10 and confidence >= CONFIDENCE_THRESHOLD:
            candidates.append(cleaned)

    return candidates
