import sys
import argparse
from src.capture.video_reader import read_video
from src.preprocess.preprocess import preprocess_frame
from src.ocr.ocr_engine import run_ocr
from src.filtering.train_number_filter import filter_train_numbers
from src.voting.vote_manager import VoteManager


def run_pipeline(video_path, frame_skip=5, vote_threshold=5, verbose=False):
    vote_manager = VoteManager(threshold=vote_threshold)
    frame_count = 0
    processed_count = 0
    final_result = None

    print(f"\n{'='*50}")
    print(f"Starting OCR Pipeline")
    print(f"Video      : {video_path}")
    print(f"Frame skip : every {frame_skip} frames")
    print(f"Vote threshold: {vote_threshold} detections")
    print(f"{'='*50}\n")

    for frame in read_video(video_path):
        frame_count += 1

        if frame_count % frame_skip != 0:
            continue

        processed_count += 1

        processed = preprocess_frame(frame)
        ocr_results = run_ocr(processed)
        candidates = filter_train_numbers(ocr_results)

        if candidates:
            vote_manager.add_candidates(candidates)

            if verbose:
                print(f"[Frame {frame_count:5d}] Candidates: {candidates}")

        best = vote_manager.get_best_candidate()

        if best and best != final_result:
            final_result = best
            print(f"\n>>> TRAIN NUMBER DETECTED: {final_result} "
                  f"(votes: {vote_manager.counter[final_result]}) @ frame {frame_count}\n")

    print(f"\n{'='*50}")
    print(f"Pipeline Complete")
    print(f"Frames read     : {frame_count}")
    print(f"Frames processed: {processed_count}")
    print(f"Vote table      : {vote_manager.get_all_votes()}")
    print(f"Final Result    : {final_result if final_result else 'No train number detected'}")
    print(f"{'='*50}\n")

    return final_result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Number OCR Pipeline")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--skip", type=int, default=5,
                        help="Process every Nth frame (default: 5)")
    parser.add_argument("--votes", type=int, default=5,
                        help="Minimum votes to confirm a train number (default: 5)")
    parser.add_argument("--verbose", action="store_true",
                        help="Print OCR candidates for every processed frame")

    args = parser.parse_args()

    result = run_pipeline(
        video_path=args.video,
        frame_skip=args.skip,
        vote_threshold=args.votes,
        verbose=args.verbose,
    )

    sys.exit(0 if result else 1)
