import cv2
import numpy as np

def preprocess_frame(frame):
    """
    Standardizes the frame for OCR. 
    By default, we preserve color as custom models are sensitive to it.
    """
    # Return as-is for now to ensure training features are preserved
    return frame
