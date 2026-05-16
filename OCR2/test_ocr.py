"""
Verify PaddleOCR loads correctly on GPU.
Run this before main.py to confirm setup is working.

    python test_ocr.py
    python test_ocr.py --image path/to/image.jpg
"""

import argparse
import sys


def test_load():
    print("Loading PaddleOCR (GPU)...")
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(
        use_textline_orientation=True,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        lang='en',
        device='gpu',
    )
    print("PaddleOCR loaded successfully on GPU.")
    return ocr


def test_on_image(ocr, image_path):
    import cv2
    from src.preprocess.preprocess import preprocess_frame
    from src.filtering.train_number_filter import filter_train_numbers

    frame = cv2.imread(image_path)
    if frame is None:
        print(f"ERROR: Cannot read image: {image_path}")
        sys.exit(1)

    print(f"\nImage: {image_path}  ({frame.shape[1]}x{frame.shape[0]})")

    processed = preprocess_frame(frame)
    result = ocr.ocr(processed)

    print("\nAll OCR detections:")
    if not result or result[0] is None:
        print("  (none)")
        return

    res = result[0]
    ocr_results = []
    for text, conf in zip(res.get("rec_texts", []), res.get("rec_scores", [])):
        print(f"  '{text}'  confidence={conf:.3f}")
        ocr_results.append({"text": text, "confidence": conf})

    candidates = filter_train_numbers(ocr_results)
    print(f"\nTrain number candidates (5-digit, conf >= 0.85): {candidates if candidates else 'none'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test PaddleOCR setup")
    parser.add_argument("--image", help="Optional image path to run OCR on", default=None)
    args = parser.parse_args()

    ocr = test_load()

    if args.image:
        test_on_image(ocr, args.image)
