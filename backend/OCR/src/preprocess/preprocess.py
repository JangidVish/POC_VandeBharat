import cv2
import numpy as np


def preprocess_frame(frame):
    # Grayscale — removes color noise, reduces compute
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Upscale 2x — OCR accuracy drops on small text
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_LINEAR)

    # Sharpen — improves character edge clarity
    kernel = np.array([
        [0, -1,  0],
        [-1, 5, -1],
        [0, -1,  0]
    ])
    sharp = cv2.filter2D(gray, -1, kernel)

    # CLAHE — adaptive contrast enhancement for uneven lighting
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(sharp)

    # Mild Gaussian blur — smooths noise without destroying edges
    denoised = cv2.GaussianBlur(enhanced, (3, 3), 0)

    return denoised
