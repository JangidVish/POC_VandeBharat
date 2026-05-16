#!/usr/bin/env python3
"""
train.py — Entry point for Vande Bharat Railway Inspection OCR Model training.
This script has been updated to be self-contained and run specifically for the OCR dataset.

Quick start:
    python train.py                                          # defaults
    python train.py --epochs 50                              # override epochs
"""
import argparse
import sys
import os
import yaml
from ultralytics import YOLO

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Train the Vande Bharat Railway Inspection OCR model"
    )
    p.add_argument("--config", default="config.yaml", help="Master config YAML")
    p.add_argument("--data",   default="OCR FRAMES.yolov8/data.yaml",   help="Dataset YAML (YOLO format)")
    p.add_argument("--epochs", type=int, default=None,
                   help="Number of training epochs (overrides config.yaml)")
    p.add_argument("--device", default=None, help="Override device: cuda | cpu | 0 | 1")
    return p.parse_args()

def load_config(path: str) -> dict:
    if not os.path.exists(path):
        print(f"Warning: Config file {path} not found. Using defaults.")
        return {}
    with open(path, 'r') as f:
        return yaml.safe_load(f)

def main():
    args = parse_args()
    config = load_config(args.config)

    # Resolve settings
    epochs = args.epochs or config.get("training", {}).get("epochs", 100)
    device = args.device or config.get("inference", {}).get("device", "")
    img_size = config.get("data", {}).get("img_size", 640)
    batch_size = config.get("data", {}).get("batch_size", 8)
    
    variant = config.get("model", {}).get("variant", "yolov8n")
    model_name = f"{variant}.pt"

    print(f"Starting OCR training with model: {model_name}")
    print(f"Dataset: {args.data}")
    print(f"Epochs: {epochs}")
    print(f"Image Size: {img_size}")
    print(f"Batch Size: {batch_size}")

    # Initialize model
    model = YOLO(model_name)

    # Train
    kwargs = {
        "data": args.data,
        "epochs": epochs,
        "imgsz": img_size,
        "batch": batch_size,
        "workers": config.get("data", {}).get("num_workers", 0),  # Fix Windows paging file issue
        "project": config.get("logging", {}).get("project", "runs"),
        "name": config.get("logging", {}).get("run_name", "ocr_inspection_v1"),
        "exist_ok": False
    }
    
    if device:
        kwargs["device"] = device

    print("--- Training ---")
    results = model.train(**kwargs)

    print("=" * 60)
    print("TRAINING COMPLETE")
    print(f"Results saved to: {results.save_dir}")
    print("=" * 60)

    return 0

if __name__ == "__main__":
    # Ensure working directory is correct
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    sys.exit(main())
