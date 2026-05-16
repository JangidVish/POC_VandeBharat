"""
Run the full OCR pipeline on a single still image (no video needed).
Useful for validating preprocessing and OCR quality on dataset images.

    python test_on_image.py <image_path>

Example:
    python test_on_image.py "../Combine Dataset/dataset/train/images/GX010973_idx00195_png.rf.rZXewjP292YLAnDBbTjG.png"
"""

import sys
import argparse
import cv2

from src.preprocess.preprocess import preprocess_frame
from src.ocr.ocr_engine import run_ocr
from src.filtering.train_number_filter import filter_train_numbers


def run_on_image(image_path, save_preprocessed=False):
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"ERROR: Cannot read image: {image_path}")
        sys.exit(1)

    print(f"\nImage     : {image_path}")
    print(f"Dimensions: {frame.shape[1]}x{frame.shape[0]}")

    processed = preprocess_frame(frame)

    if save_preprocessed:
        out_path = image_path.rsplit(".", 1)[0] + "_preprocessed.jpg"
        cv2.imwrite(out_path, processed)
        print(f"Preprocessed saved: {out_path}")

    ocr_results = run_ocr(processed)

    print("\nAll OCR detections:")
    if not ocr_results:
        print("  (none)")
    else:
        for item in ocr_results:
            marker = " <-- TRAIN NUMBER" if len(item["text"].replace(" ", "")) == 5 and item["text"].replace(" ", "").isdigit() else ""
            print(f"  '{item['text']}'  confidence={item['confidence']:.3f}{marker}")

    candidates = filter_train_numbers(ocr_results)
    print(f"\nFiltered train number candidates: {candidates if candidates else 'none'}")

    return candidates


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test OCR on a single image")
    parser.add_argument("image", help="Path to image file")
    parser.add_argument("--save-preprocessed", action="store_true",
                        help="Save the preprocessed image alongside the original")
    args = parser.parse_args()

    run_on_image(args.image, save_preprocessed=args.save_preprocessed)
