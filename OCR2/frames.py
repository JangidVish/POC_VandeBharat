import cv2
import os
import numpy as np
import glob
from concurrent.futures import ThreadPoolExecutor

# ================= CONFIG =================
VIDEO_PATTERN = "GX01*.mp4"  
# Now we only define the root directory, not the specific '973_frames' folder
DATASET_ROOT = "./Railway Dataset"

INTERVAL_SEC   = 0.5
WINDOW_FRAMES  = 10
LOW_THRESHOLD  = 10  
HIGH_THRESHOLD = 20 

MAX_WORKERS = 4 
# ==========================================

def sharpness_roi(frame):
    """Calculates focus score on the lower-middle track region."""
    h, w = frame.shape[:2]
    roi = frame[int(h*0.4):int(h*0.8), int(w*0.2):int(w*0.8)]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def process_video(video_path):
    video_filename = os.path.basename(video_path)
    video_name_only = os.path.splitext(video_filename)[0]
    
    # --- DYNAMIC ROOT FOLDER ---
    # Replaces '973_frames'. Now it creates e.g., "./Railway Dataset/GX010967_frames"
    video_root = os.path.join(DATASET_ROOT, f"{video_name_only}_frames")
    
    # Sub-folders inside the dynamic video root
    raw_folder    = os.path.join(video_root, "raw_extracts")
    sharp_folder  = os.path.join(video_root, "sharp_best")
    medium_folder = os.path.join(video_root, "medium_quality")
    
    # Skip check
    completion_flag = os.path.join(video_root, "status_complete.log")
    if os.path.exists(completion_flag):
        print(f"⏩ SKIPPING: {video_filename} (Found in {video_root})")
        return

    print(f"🎬 PROCESSING: {video_filename} -> Outputting to /{video_name_only}_frames/")
    
    # Create the folders
    for folder in [raw_folder, sharp_folder, medium_folder]:
        os.makedirs(folder, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ ERROR: Failed to open {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # --- ADDED: Get total frames to calculate percentage ---
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) 
    
    interval = int(fps * INTERVAL_SEC)
    
    frame_buffer = {}
    frame_count = 0
    saved_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_buffer[frame_count] = frame.copy()

        if frame_count > 0 and frame_count % interval == 0:
            start = max(0, frame_count - WINDOW_FRAMES)
            end   = frame_count + WINDOW_FRAMES

            candidates = {
                idx: frame_buffer[idx]
                for idx in range(start, min(end + 1, frame_count + 1))
                if idx in frame_buffer
            }

            if candidates:
                best_idx = max(candidates, key=lambda i: sharpness_roi(candidates[i]))
                best_frame = candidates[best_idx]
                score = sharpness_roi(best_frame)

                # Name: [VideoName]_idx[Number].png
                save_name = f"{video_name_only}_idx{saved_count:05d}.png"
                
                cv2.imwrite(os.path.join(raw_folder, save_name), best_frame)

                if score >= HIGH_THRESHOLD:
                    cv2.imwrite(os.path.join(sharp_folder, save_name), best_frame)
                elif score >= LOW_THRESHOLD:
                    cv2.imwrite(os.path.join(medium_folder, save_name), best_frame)
                
                saved_count += 1
                
                # --- ADDED: Progress & Remaining Percentage Update ---
                percent_complete = (frame_count / total_frames) * 100
                percent_remaining = 100.0 - percent_complete
                print(f"🔄 [{video_name_only}] Saved frame {saved_count} | {percent_remaining:.2f}% remaining to process")

            cutoff = frame_count - WINDOW_FRAMES - 1
            for k in list(frame_buffer.keys()):
                if k < cutoff:
                    del frame_buffer[k]

        frame_count += 1

    cap.release()
    
    with open(completion_flag, "w") as f:
        f.write(f"Extraction successful. Total frames saved: {saved_count}")

    print(f"✅ DONE: {video_filename} (Saved {saved_count} frames)")

def main():
    video_list = glob.glob(VIDEO_PATTERN)
    
    if not video_list:
        print(f"🔍 No videos found matching '{VIDEO_PATTERN}'")
        return

    print(f"📂 Found {len(video_list)} videos. Initializing ThreadPool...")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        executor.map(process_video, video_list)

    print("\n🏁 PIPELINE COMPLETE.")

if __name__ == "__main__":
    main()