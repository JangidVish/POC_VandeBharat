#!/usr/bin/env python3
"""
Vande Bharat — Dataset Relabeling & Merge Script
-------------------------------------------------
Reads multiple YOLO-format datasets, remaps class IDs to canonical
43-class schema, merges into one combined dataset.

Requirements:  pip install pyyaml
Usage:         python relabel_and_merge.py
"""

import os
import shutil
import yaml
from pathlib import Path
from collections import defaultdict


# ── CONFIG — edit these paths on your laptop ──────────────────────────────
# List every source dataset folder (the one containing data.yaml + train/valid/test)
SOURCE_DATASETS = [
    r"PATH\TO\dataset-1",   # corresponds to data-1.yaml
    r"PATH\TO\dataset-2",   # corresponds to data-2.yaml
    r"PATH\TO\dataset-3",
    r"PATH\TO\dataset-4",
    r"PATH\TO\dataset-5",
    r"PATH\TO\dataset-6",
    r"PATH\TO\dataset-7",
    r"PATH\TO\dataset-8",
    r"PATH\TO\dataset-original",  # original data.yaml
]

# Where to write the merged dataset
OUTPUT_DIR = r"PATH\TO\combined_dataset"

SPLITS = ["train", "valid", "test"]
# ──────────────────────────────────────────────────────────────────────────


# ── CANONICAL CLASSES (index = class_id in final data.yaml) ───────────────
CANONICAL_CLASSES = [
    # Components (0–31)
    "battery_box",               # 0
    "primary_suspension_spring", # 1
    "secondary_suspension_spring", # 2
    "transformer",               # 3
    "bio_tank",                  # 4
    "water_tank",                # 5
    "auxiliary_reservoir",       # 6
    "axle_box_cover",            # 7
    "electrical_box",            # 8
    "steps_footboard",           # 9
    "j_bracket",                 # 10
    "brake_control_module",      # 11
    "damper",                    # 12
    "wheel",                     # 13
    "pipes",                     # 14
    "nut_bolt",                  # 15
    "axle",                      # 16
    "wire",                      # 17
    "grill_cover",               # 18
    "outlet_pipe",               # 19
    "hydraulic_valve",           # 20
    "rod",                       # 21
    "sab",                       # 22
    "cbc_shank",                 # 23
    "bogie_frame",               # 24
    "disc",                      # 25
    "brake_head",                # 26
    "brake_lever",               # 27
    "ladder",                    # 28
    "safety_strap",              # 29
    "swing_hanger",              # 30
    "water_pump",                # 31
    # Defects (32–42)
    "crack",                     # 32
    "rust",                      # 33
    "leakage",                   # 34
    "deformation",               # 35
    "missing_part",              # 36
    "broken",                    # 37
    "puncture",                  # 38
    "hanging",                   # 39
    "loose",                     # 40
    "hole",                      # 41
    "smoke_emission",            # 42
]

CANONICAL_TO_ID = {name: i for i, name in enumerate(CANONICAL_CLASSES)}


# ── OLD NAME → CANONICAL NAME (None = drop label — noise/unmappable) ───────
OLD_TO_CANONICAL = {
    # ── data.yaml (original) ──
    "Corrosion-induced_perforation": "rust",
    "acod_leak":                     "leakage",
    "air_tank":                      "auxiliary_reservoir",
    "auxilliary_reservoir":          "auxiliary_reservoir",
    "battery_box":                   "battery_box",
    "busted":                        "deformation",
    "crack":                         "crack",
    "deformed":                      "deformation",
    "footboard":                     "steps_footboard",
    "leakage":                       "leakage",
    "missing_bolt":                  "missing_part",
    "missing_part":                  "missing_part",
    "pipes":                         "pipes",
    "primary_coil_spring":           "primary_suspension_spring",
    "puncture":                      "puncture",
    "regulator":                     "hydraulic_valve",
    "rust":                          "rust",
    "transformer":                   "transformer",

    # ── data-1.yaml ──
    "Axle Box Cover":                "axle_box_cover",
    "Battery Box":                   "battery_box",
    "Crack":                         "crack",
    "Deformation":                   "deformation",
    "Electricity Box":               "electrical_box",
    "Rusting":                       "rust",
    "Suspension":                    "primary_suspension_spring",

    # ── data-2.yaml ──
    "Air Brake Hose":                "pipes",
    "Air Spring":                    "primary_suspension_spring",
    "Axle":                          "axle",
    "Axle Wheel":                    "wheel",
    "Battery box":                   "battery_box",
    "Bio Tank":                      "bio_tank",
    "Brake Lever":                   "brake_lever",
    "Braking system":                "brake_control_module",
    "Cooling Grill":                 "grill_cover",
    "Damper":                        "damper",
    "Disc":                          "disc",
    "Electrical Junction Boxes":     "electrical_box",
    "Electrical Panel":              "electrical_box",
    "Electricity Compenent Box":     "electrical_box",
    "Electricity pipe":              "pipes",
    "Hydraulic Hoses":               "pipes",
    "Hydraulic Valve":               "hydraulic_valve",
    "LADDER":                        "ladder",
    "Leaf spring Suspension":        "primary_suspension_spring",
    "Pressure Valve":                "hydraulic_valve",
    "Protective Grill":              "grill_cover",
    "Push rod":                      "rod",
    "SAB":                           "sab",
    "Steel Frame":                   None,        # no clear canonical
    "Suspension Frame":              None,        # no clear canonical
    "Suspention":                    None,        # typo, too ambiguous
    "Transformer":                   "transformer",
    "U bolt Clamp":                  "nut_bolt",
    "Utility Lines":                 "pipes",
    "Ventilation Grill":             "grill_cover",
    "Vertical Damper":               "damper",
    "Water Reservoir":               "auxiliary_reservoir",
    "Water Tank":                    "water_tank",
    "Wheel":                         "wheel",
    "Yaw Damper":                    "damper",
    "screws":                        "nut_bolt",

    # ── data-3.yaml ──
    "Bracket":                       None,        # too generic
    "Cover Box":                     None,        # unclear
    "Engine":                        None,        # too generic
    "J Joint":                       "j_bracket",
    "MCB":                           None,        # electrical component, no canonical
    "Metal Net Cover":               "grill_cover",
    "Nut system":                    "nut_bolt",
    "Outlet Pipe":                   "outlet_pipe",
    "Primary Suspension":            "primary_suspension_spring",
    "Secondary suspension":          "secondary_suspension_spring",
    "Steps":                         "steps_footboard",
    "Supporting Rod":                "rod",
    "Switch":                        None,        # no canonical
    "Tank":                          None,        # too generic
    "Wire":                          "wire",
    "nuts":                          "nut_bolt",

    # ── data-4.yaml ──
    "Bolster":                       "bogie_frame",
    "Bolster_secondary_spring":      "secondary_suspension_spring",
    "CBC_shank":                     "cbc_shank",
    "Coil_spring_primary":           "primary_suspension_spring",
    "Lower_spring_beam":             "rod",
    "Safety_strap":                  "safety_strap",
    "Swing_links_Hangers":           "swing_hanger",
    "axle_box_safety_bolt":          "nut_bolt",
    "axle_house_boxing":             "axle_box_cover",
    "beam_with_wear_plate":          None,        # no canonical
    "bio_tank":                      "bio_tank",
    "bogie_frame":                   "bogie_frame",
    "bolt":                          "nut_bolt",
    "brake_head":                    "brake_head",
    "brake_hose_pipes":              "pipes",
    "compression_springs":           "primary_suspension_spring",
    "inletvalve":                    "hydraulic_valve",
    "j_bracket":                     "j_bracket",
    "outlet":                        "outlet_pipe",
    "reservoir":                     "auxiliary_reservoir",
    "shock_absorber":                "damper",
    "steps":                         "steps_footboard",
    "striker _support":              None,        # unclear
    "water_pump":                    "water_pump",
    "water_tank":                    "water_tank",
    "wire_rope":                     "wire",

    # ── data-5.yaml ──
    "Brake Control Module":          "brake_control_module",
    "NutBoults":                     "nut_bolt",
    "Primary Suspension Spring Coil": "primary_suspension_spring",
    "Secondary Suspension Spring Coil": "secondary_suspension_spring",

    # ── data-6.yaml ──
    "Auxiliary tank":                "auxiliary_reservoir",
    "Bend in the rod":               "deformation",
    "Broken net":                    "broken",
    "Broken step":                   "broken",
    "Broken steps":                  "broken",
    "Crack in suspension":           "crack",
    "Crack in the suspension":       "crack",
    "Hanging part":                  "hanging",
    "Hanging part from step":        "hanging",
    "Leakage in the auxiliary tank": "leakage",
    "Missing nuts":                  "missing_part",
    "Oil leakage":                   "leakage",
    "Open door of the transformer":  "broken",
    "Primary suspension":            "primary_suspension_spring",
    "Rust in Battery box":           "rust",
    "Rust in primary suspension":    "rust",
    "Rust in the pipe":              "rust",
    "Rust in the supporting Rod":    "rust",
    "Rust insuspension":             "rust",
    "Train-parts-detection":         None,        # NOISE: project name
    "hanging wires":                 "hanging",
    "hole":                          "hole",
    "lose rods":                     "loose",
    "missing rust":                  None,        # NOISE: labeling error
    "outlet pipe":                   "outlet_pipe",
    "rust in rod":                   "rust",
    "rust in the nut":               "rust",
    "rust in the waste outlet":      "rust",
    "smoke is coming from the transformer": "smoke_emission",

    # ── data-7.yaml ──
    "Brake Module":                  "brake_control_module",
    "Broken":                        "broken",
    "Electric Box":                  "electrical_box",
    "ElectricBox":                   "electrical_box",
    "Loose Nutboult":                "loose",
    "Missing NutBoult":              "missing_part",
    "Phonicwheel cover":             "wheel",
    "Primary Suspension":            "primary_suspension_spring",
    "Puncture":                      "puncture",
    "Secondary Suspension":          "secondary_suspension_spring",
    "Water Reservior":               "auxiliary_reservoir",
    "Y shaped joint":                "j_bracket",

    # ── data-8.yaml ──
    "AXial":                         "axle",
    "Battery":                       "battery_box",
    "Bio-Tank":                      "bio_tank",
    "J joint":                       "j_bracket",
    "Nut":                           "nut_bolt",
    "Pipes":                         "pipes",
    "stair":                         "steps_footboard",
}


# ── HELPERS ────────────────────────────────────────────────────────────────

def load_yaml(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def find_labels_dir(dataset_root, split):
    """
    Roboflow datasets use either:
      <root>/<split>/labels/
      <root>/labels/<split>/
    Returns Path or None.
    """
    candidates = [
        Path(dataset_root) / split / "labels",
        Path(dataset_root) / "labels" / split,
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def find_images_dir(dataset_root, split):
    candidates = [
        Path(dataset_root) / split / "images",
        Path(dataset_root) / "images" / split,
        Path(dataset_root) / split,
    ]
    for c in candidates:
        if c.exists() and any(c.iterdir()):
            return c
    return None


def build_remap(source_class_names):
    """
    Returns:
      remap: dict[old_id (int)] -> new_id (int) or None (drop)
      unmapped: list of old class names with no canonical mapping
    """
    remap = {}
    unmapped = []
    for old_id, old_name in enumerate(source_class_names):
        canonical = OLD_TO_CANONICAL.get(old_name)
        if canonical is None:
            if old_name not in OLD_TO_CANONICAL:
                unmapped.append(old_name)
                remap[old_id] = None
            else:
                remap[old_id] = None  # explicitly set to drop
        else:
            new_id = CANONICAL_TO_ID.get(canonical)
            if new_id is None:
                print(f"  [BUG] canonical '{canonical}' not in CANONICAL_CLASSES — skipping")
                remap[old_id] = None
            else:
                remap[old_id] = new_id
    return remap, unmapped


def remap_label_file(src_txt, dst_txt, remap):
    """
    Read YOLO .txt, remap class IDs, write to dst.
    Lines where class maps to None are dropped.
    Returns (kept, dropped) counts.
    """
    kept = dropped = 0
    lines_out = []
    with open(src_txt, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            old_id = int(parts[0])
            new_id = remap.get(old_id)
            if new_id is None:
                dropped += 1
            else:
                parts[0] = str(new_id)
                lines_out.append(" ".join(parts))
                kept += 1

    dst_txt.parent.mkdir(parents=True, exist_ok=True)
    with open(dst_txt, "w") as f:
        f.write("\n".join(lines_out))
        if lines_out:
            f.write("\n")

    return kept, dropped


def process_dataset(dataset_root, dataset_idx, output_root, stats):
    dataset_root = Path(dataset_root)
    yaml_path = dataset_root / "data.yaml"

    if not yaml_path.exists():
        print(f"\n[SKIP] No data.yaml in {dataset_root}")
        return

    data = load_yaml(yaml_path)
    source_classes = data.get("names", [])
    print(f"\n── Dataset {dataset_idx}: {dataset_root.name}")
    print(f"   Classes ({len(source_classes)}): {source_classes}")

    remap, unmapped = build_remap(source_classes)
    if unmapped:
        print(f"   [WARN] Unmapped (will be dropped): {unmapped}")
        stats["unmapped"].extend(unmapped)

    for split in SPLITS:
        img_dir = find_images_dir(dataset_root, split)
        lbl_dir = find_labels_dir(dataset_root, split)

        if img_dir is None:
            print(f"   [SKIP] No images dir for split '{split}'")
            continue

        out_img_dir = Path(output_root) / split / "images"
        out_lbl_dir = Path(output_root) / split / "labels"
        out_img_dir.mkdir(parents=True, exist_ok=True)
        out_lbl_dir.mkdir(parents=True, exist_ok=True)

        img_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        images = [f for f in img_dir.iterdir() if f.suffix.lower() in img_exts]

        split_kept = split_dropped = split_no_label = 0

        for img_path in images:
            # Prefix filename with dataset index to avoid collisions
            new_stem = f"ds{dataset_idx}_{img_path.stem}"
            dst_img = out_img_dir / (new_stem + img_path.suffix)
            shutil.copy2(img_path, dst_img)

            # Find corresponding label file
            if lbl_dir is not None:
                src_lbl = lbl_dir / (img_path.stem + ".txt")
                if src_lbl.exists():
                    dst_lbl = out_lbl_dir / (new_stem + ".txt")
                    kept, dropped = remap_label_file(src_lbl, dst_lbl, remap)
                    split_kept += kept
                    split_dropped += dropped
                else:
                    split_no_label += 1
            else:
                split_no_label += 1

        print(f"   [{split}] images={len(images)}  labels_kept={split_kept}"
              f"  labels_dropped={split_dropped}  no_label={split_no_label}")

        stats["total_images"] += len(images)
        stats["total_kept"] += split_kept
        stats["total_dropped"] += split_dropped


def write_combined_yaml(output_root):
    out = {
        "train": "../train/images",
        "val":   "../valid/images",
        "test":  "../test/images",
        "nc":    len(CANONICAL_CLASSES),
        "names": CANONICAL_CLASSES,
    }
    yaml_path = Path(output_root) / "data.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(out, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    print(f"\ndata.yaml written → {yaml_path}")


# ── MAIN ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Vande Bharat — Dataset Relabel & Merge")
    print("=" * 60)

    output_root = Path(OUTPUT_DIR)
    output_root.mkdir(parents=True, exist_ok=True)

    stats = {
        "total_images": 0,
        "total_kept": 0,
        "total_dropped": 0,
        "unmapped": [],
    }

    for idx, src in enumerate(SOURCE_DATASETS, start=1):
        if not os.path.exists(src):
            print(f"\n[WARN] Path not found, skipping: {src}")
            continue
        process_dataset(src, idx, output_root, stats)

    write_combined_yaml(output_root)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total images copied : {stats['total_images']}")
    print(f"  Label lines kept    : {stats['total_kept']}")
    print(f"  Label lines dropped : {stats['total_dropped']}")
    unique_unmapped = sorted(set(stats["unmapped"]))
    print(f"  Unmapped class names ({len(unique_unmapped)}):")
    for name in unique_unmapped:
        print(f"    - {name}")
    print(f"\n  Output → {output_root}")
    print("=" * 60)
    print("Done.")


if __name__ == "__main__":
    main()
