import re

# Bogie numbers: alphanumeric, 4-20 chars, may contain hyphens/slashes
# Examples: WGS-19847, BWF2019047, LWFAC-123, 12345, ABC/1234
BOGIE_PATTERN = re.compile(r'^[A-Z0-9][A-Z0-9\-/]{3,19}$', re.IGNORECASE)

CONFIDENCE_THRESHOLD = 0.5


def filter_train_numbers(ocr_results):
    candidates = []

    for item in ocr_results:
        text = item["text"]
        confidence = item["confidence"]

        cleaned = text.replace(" ", "").strip()

        if BOGIE_PATTERN.match(cleaned) and confidence >= CONFIDENCE_THRESHOLD:
            candidates.append(cleaned.upper())

    return candidates
