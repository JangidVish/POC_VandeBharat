import re

# Train numbers: strictly 5 or 6 digits only (e.g., 14630, 22436, 124235)
TRAIN_NUMBER_PATTERN = re.compile(r'^\d{5,6}$')

CONFIDENCE_THRESHOLD = 0.4


def filter_train_numbers(ocr_results):
    candidates = []

    for item in ocr_results:
        text = item["text"]
        confidence = item["confidence"]

        # Clean spaces and strip whitespace
        cleaned = text.replace(" ", "").strip()

        # Enforce exact 5 or 6 digit number regex check
        if TRAIN_NUMBER_PATTERN.match(cleaned) and confidence >= CONFIDENCE_THRESHOLD:
            candidates.append(cleaned)

    return candidates
