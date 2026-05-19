import os
import sys
import cv2
import numpy as np

# Ensure dynamic DLL path loading is applied
if sys.platform == "win32":
    for pkg in ["nvidia.cudnn", "nvidia.cublas", "nvidia.cuda_runtime", "nvidia.cusparse"]:
        try:
            mod = __import__(pkg, fromlist=["__file__"])
            pkg_bin = os.path.abspath(os.path.join(os.path.dirname(mod.__file__), "bin"))
            if os.path.exists(pkg_bin):
                print(f"[TEST] Injecting DLL path for {pkg}: {pkg_bin}")
                os.add_dll_directory(pkg_bin)
        except Exception:
            pass

from src.ocr.ocr_engine import run_ocr

def test():
    print("1. Creating a synthetic image with text...")
    # Create a 400x150 white canvas
    img = np.ones((150, 400, 3), dtype=np.uint8) * 255
    # Write clear black text "14630"
    cv2.putText(img, "14630", (50, 95), cv2.FONT_HERSHEY_SIMPLEX, 2.5, (0, 0, 0), 5, cv2.LINE_AA)
    
    cv2.imwrite("test_text.jpg", img)
    print("   Image saved to test_text.jpg")
    
    print("\n2. Initializing & running run_ocr...")
    result = run_ocr(img)
    print(f"   Parsed OCR Result: {result}")
    
    if result:
        print("\nSUCCESS! Detected:")
        for res in result:
            print(f"   - Box: {res['box']}")
            print(f"   - Text: {res['text']} (Confidence: {res['confidence']:.3f})")
    else:
        print("\nFAILED: No text parsed.")

if __name__ == "__main__":
    test()
