# From Labeled Datasets → best.pt
### Complete Beginner Guide — Vande Bharat Defect Detection

---

## What You Have Right Now

```
poc/backend/models/yolov8n.pt     ← pretrained base model (NOT your trained model)
12 dataset folders/                ← your labeled images + annotations
    each has:
        train/images/
        train/labels/
        valid/images/
        valid/labels/
        test/images/
        test/labels/
        data.yaml
```

**What is `yolov8n.pt`?**
Think of it like a student who already knows how to "see" — trained on 80 general categories (cars, people, dogs, etc.) on the internet. You are going to teach this student to specifically recognize train defects. This process is called **Transfer Learning** — you transfer existing knowledge and fine-tune it for your task.

**What is `best.pt`?**
After training, YOLOv8 saves a checkpoint every epoch. `best.pt` = the checkpoint where your model performed best on the validation set. This is the file you deploy.

---

## The Core Problem With Your 12 Datasets

Before training, you must solve one critical issue: **your 12 datasets don't speak the same language.**

### Example of the conflict:

| Same physical thing | Dataset A calls it | Dataset B calls it | Dataset C calls it |
|---|---|---|---|
| Battery box on train | `Battery` | `Battery box` | `Battery Box` |
| Electric panel | `Electric Box` | `ElectricBox` | `Electricity Box` |
| Nut/bolt | `Nut` | `Loose Nutboult` | `NutBoults` |

In YOLO format, labels are stored as **numbers**, not text:
```
0 0.5 0.3 0.2 0.4    ← class_id  cx  cy  width  height
```

If Dataset A says class `0` = `Crack` but Dataset B says class `0` = `Axle Box Cover` — merging them without fixing this will **corrupt your training data** and produce a useless model.

### Second problem — annotation strategy mismatch:

Some of your datasets annotated **what the component is** (e.g., "Battery Box", "Axle Box Cover").
Some annotated **what the defect is** (e.g., "Crack", "Broken", "Rusting").
Some mixed both.

You cannot train a model on contradictory annotation strategies.

---

## All Possible Approaches

### Approach 1 — Full Superset (All Unique Classes)

**What it means:** Create one master class list with every unique class across all 12 datasets. Map each dataset's classes to the correct master ID. Manually relabel conflicts.

**Total classes would be:** ~25–35 unique classes

**Pros:**
- Most information preserved
- Model can distinguish between component types AND defect types
- Best for a mature production system

**Cons:**
- Requires manually resolving all naming conflicts across 12 datasets
- Some classes have very few examples (class imbalance problem)
- Requires expert domain knowledge to decide: is "Suspension" the same as "Primary Suspension Spring Coil"?
- Very complex merge script
- A beginner can easily corrupt labels silently — no obvious error, just bad model

**Verdict:** Best long-term goal. Wrong starting point for a beginner.

---

### Approach 2 — Components Only (Ignore Defect Labels)

**What it means:** Keep only component-type labels (Axle Box Cover, Battery Box, etc.). Discard Crack, Broken, Rusting, etc.

**Pros:**
- Fewer classes to unify
- Good for a "what am I looking at" detector

**Cons:**
- Doesn't detect defects — defeats the purpose of the project
- Still has naming conflicts to resolve

**Verdict:** Wrong for this project. Goal is defect detection, not component identification.

---

### Approach 3 — Defect Types Only (Ignore Component Labels)

**What it means:** Keep only defect labels (Crack, Broken, Rusting, Deformation, Puncture, Loose bolt, Missing bolt). Discard component identity labels.

**Classes would be:**
- `crack`
- `broken`
- `deformation`
- `rusting`
- `puncture`
- `loose_bolt`
- `missing_bolt`

**Pros:**
- Directly answers "is there a defect?"
- Fewer classes (~7)
- Most datasets already have these labels
- Aligns with project goal

**Cons:**
- Discards component labels — model won't say "crack on Axle Box Cover", just "crack"
- Still needs class remapping

**Verdict:** Good intermediate step. Better than Approach 1 for now.

---

### Approach 4 — Binary Classification: `defect` / `normal` ✅ RECOMMENDED FOR YOU

**What it means:** Collapse everything into 2 classes only:
- Class `0` = `defect` — anything that is wrong (Crack, Broken, Rusting, Deformation, Loose bolt, Missing bolt, Puncture, Shelling, Sparking)
- Class `1` = `normal` — component is visible and healthy

**Why this is the best approach for your situation:**

1. **Solves the naming conflict problem automatically.** You don't need to decide if "Suspension" = "Primary Suspension Spring Coil". You only need to decide: is this a defect or not?

2. **Matches your project specification exactly.** Your CLAUDE.md says: *"Binary: crack / normal"*

3. **Safest for a safety-critical system.** From your CLAUDE.md: *"false negatives are the worst failure mode"*. Binary classification with a low threshold maximizes recall. With 25 classes, the model can get confused between similar-looking defect types. With 2 classes, it just answers: defect or not?

4. **Works with all 12 datasets.** Every dataset has at least some defect labels. You don't throw away any data.

5. **Simplest to implement correctly.** Less code, less chance of silent label corruption.

6. **You can always upgrade later.** Once binary model works well, add defect-type classes in v2.

**Cons:**
- Model won't tell you WHAT TYPE of defect (crack vs rusting vs loose bolt)
- Less information for the maintenance engineer

**When to move beyond binary:** After your binary model achieves >90% recall, train v2 with defect subtypes using the same merged dataset.

---

## The Recommended Path: Binary → Best.pt

### Phase 0 — Understand Your Data (30 minutes)

Before writing any code, look at what you have.

Run this to see all your dataset structures:
```
Open file explorer → go to each of the 12 folders → open data.yaml in Notepad
Write down: folder name, nc value, class names
```

Make a table like this:
```
Folder          | nc | Defect Classes Present
----------------|----|-----------------------
component_01    | 8  | none
component_02    | 16 | Crack, Broken, Puncture
...
```

---

### Phase 1 — Set Up Python Environment (1 hour)

Install the tools you need.

**Step 1: Install Python**
Download from python.org → install → tick "Add to PATH" checkbox.

**Step 2: Open terminal (Command Prompt or PowerShell)**
Press `Windows + R` → type `cmd` → press Enter

**Step 3: Install required packages**
```bash
pip install ultralytics opencv-python numpy pyyaml
```

**Step 4: Verify install**
```bash
python -c "from ultralytics import YOLO; print('OK')"
```
Should print `OK`. If error, run Step 3 again.

---

### Phase 2 — Merge Datasets with Class Remapping (2–3 hours)

This is the most important step. You will write one Python script that:
1. Reads each dataset
2. Remaps every class to either `0` (defect) or `1` (normal)
3. Copies images and rewritten label files to one merged folder

**Create this file: `D:\Automation\Vande Baharat\merge_datasets.py`**

```python
import shutil
import yaml
from pathlib import Path

# ─────────────────────────────────────────────
# CONFIGURE: Add all 12 dataset folder paths here
# ─────────────────────────────────────────────
DATASET_FOLDERS = [
    Path(r"D:\path\to\dataset_01"),
    Path(r"D:\path\to\dataset_02"),
    Path(r"D:\path\to\dataset_03"),
    # ... add all 12
]

# ─────────────────────────────────────────────
# CONFIGURE: For each dataset, list which class NAMES are defects.
# Copy exact spelling from each data.yaml.
# Anything NOT listed here = treated as "normal".
# ─────────────────────────────────────────────
DEFECT_CLASS_NAMES = {
    # From dataset_02
    "Broken", "Crack", "Puncture", "Loose Nutboult", "Missing NutBoult",
    # From dataset_03
    "Deformation", "Rusting",
    # Add more from remaining 8 datasets after you share them
}

OUTPUT_DIR = Path(r"D:\Automation\Vande Baharat\merged_dataset")

# Binary class map
DEFECT_ID = 0   # class 0 = defect
NORMAL_ID = 1   # class 1 = normal

# ─────────────────────────────────────────────

def remap_label_file(src_label: Path, dest_label: Path, class_names: list[str]):
    """Read a YOLO .txt label, remap class IDs to binary, write to dest."""
    lines = src_label.read_text().strip().splitlines()
    new_lines = []
    for line in lines:
        if not line.strip():
            continue
        parts = line.split()
        orig_class_id = int(parts[0])
        class_name = class_names[orig_class_id]
        new_class_id = DEFECT_ID if class_name in DEFECT_CLASS_NAMES else NORMAL_ID
        new_lines.append(f"{new_class_id} " + " ".join(parts[1:]))
    dest_label.write_text("\n".join(new_lines))


def merge():
    for split in ["train", "valid", "test"]:
        (OUTPUT_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    total_images = 0
    total_defect_labels = 0
    total_normal_labels = 0

    for ds_path in DATASET_FOLDERS:
        yaml_path = ds_path / "data.yaml"
        if not yaml_path.exists():
            print(f"WARNING: No data.yaml in {ds_path}, skipping")
            continue

        with open(yaml_path) as f:
            config = yaml.safe_load(f)

        class_names = config["names"]
        print(f"\nProcessing: {ds_path.name}")
        print(f"  Classes: {class_names}")

        for split in ["train", "valid", "test"]:
            img_dir = ds_path / split / "images"
            lbl_dir = ds_path / split / "labels"

            if not img_dir.exists():
                continue

            for img_path in img_dir.glob("*"):
                if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp"}:
                    continue

                # Unique name = dataset_folder + original filename
                unique_name = f"{ds_path.name}__{img_path.name}"
                dest_img = OUTPUT_DIR / "images" / split / unique_name
                shutil.copy2(img_path, dest_img)

                # Corresponding label file
                lbl_path = lbl_dir / (img_path.stem + ".txt")
                dest_lbl = OUTPUT_DIR / "labels" / split / (
                    f"{ds_path.name}__{img_path.stem}.txt"
                )

                if lbl_path.exists():
                    remap_label_file(lbl_path, dest_lbl, class_names)
                    # Count stats
                    for line in dest_lbl.read_text().strip().splitlines():
                        if line.strip():
                            cid = int(line.split()[0])
                            if cid == DEFECT_ID:
                                total_defect_labels += 1
                            else:
                                total_normal_labels += 1
                else:
                    # No label file = background image, create empty label
                    dest_lbl.write_text("")

                total_images += 1

    # Write unified data.yaml
    out_yaml = {
        "path": str(OUTPUT_DIR),
        "train": "images/train",
        "val": "images/valid",
        "test": "images/test",
        "nc": 2,
        "names": ["defect", "normal"],
    }
    with open(OUTPUT_DIR / "data.yaml", "w") as f:
        yaml.dump(out_yaml, f, default_flow_style=False)

    print("\n" + "="*50)
    print(f"MERGE COMPLETE")
    print(f"Total images copied : {total_images}")
    print(f"Defect annotations  : {total_defect_labels}")
    print(f"Normal annotations  : {total_normal_labels}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"data.yaml written: {OUTPUT_DIR / 'data.yaml'}")


if __name__ == "__main__":
    merge()
```

**Run it:**
```bash
cd "D:\Automation\Vande Baharat"
python merge_datasets.py
```

**What to check after running:**
- `Defect annotations` and `Normal annotations` should both be non-zero
- If `Defect annotations = 0`, your `DEFECT_CLASS_NAMES` set doesn't match spelling in data.yaml
- Total images should equal sum of all images across all 12 datasets

---

### Phase 3 — Verify Merged Dataset (15 minutes)

Run this quick sanity check before wasting hours training on broken data:

```python
# save as verify_dataset.py
from pathlib import Path

MERGED = Path(r"D:\Automation\Vande Baharat\merged_dataset")

for split in ["train", "valid", "test"]:
    imgs = list((MERGED / "images" / split).glob("*"))
    lbls = list((MERGED / "labels" / split).glob("*.txt"))
    print(f"{split}: {len(imgs)} images, {len(lbls)} label files")

    # Check for class IDs outside 0-1
    bad = 0
    for lbl in lbls:
        for line in lbl.read_text().strip().splitlines():
            if line.strip():
                cid = int(line.split()[0])
                if cid not in (0, 1):
                    bad += 1
    if bad:
        print(f"  WARNING: {bad} labels with invalid class ID!")
    else:
        print(f"  All class IDs valid (0 or 1)")
```

---

### Phase 4 — Train the Model (2–8 hours depending on your GPU)

```bash
cd "D:\Automation\Vande Baharat"
yolo train \
  model=poc/backend/models/yolov8n.pt \
  data=merged_dataset/data.yaml \
  epochs=50 \
  imgsz=640 \
  batch=16 \
  patience=10 \
  project=training_runs \
  name=vande_bharat_v1
```

**What these parameters mean:**

| Parameter | Value | Meaning |
|---|---|---|
| `model` | `yolov8n.pt` | Start from pretrained weights (transfer learning) |
| `data` | your merged yaml | Where to find images and labels |
| `epochs` | `50` | How many times to loop through entire dataset |
| `imgsz` | `640` | Resize all images to 640×640 for training |
| `batch` | `16` | Process 16 images at once (reduce to 8 if out of RAM) |
| `patience` | `10` | Stop early if no improvement for 10 epochs |
| `project` | `training_runs` | Folder to save results |
| `name` | `vande_bharat_v1` | Name of this training run |

**While training runs, you'll see output like:**
```
Epoch    GPU_mem   box_loss   cls_loss   dfl_loss  Instances       Size
  1/50     2.34G      1.234      0.891      1.102         23        640
  2/50     2.34G      1.198      0.843      1.087         31        640
...
```
- `box_loss`, `cls_loss` should decrease over epochs — means model is learning
- If loss goes up and stays up after 20 epochs — something is wrong with data

**After training completes:**
```
training_runs/
└── vande_bharat_v1/
    └── weights/
        ├── best.pt      ← USE THIS
        └── last.pt      ← last epoch (not necessarily best)
```

---

### Phase 5 — Evaluate the Model

```bash
yolo val \
  model=training_runs/vande_bharat_v1/weights/best.pt \
  data=merged_dataset/data.yaml
```

**Key metrics to look at:**

| Metric | What it means | Target for safety-critical |
|---|---|---|
| **Recall** | Of all real defects, how many did we catch? | > 0.85 |
| **Precision** | Of all things we flagged, how many were real defects? | > 0.70 |
| **mAP50** | Overall detection quality | > 0.75 |
| **F1** | Balance of precision and recall | > 0.75 |

**Why recall matters more:** A false negative (missed defect) can cause a train accident. A false positive (flagging a healthy component) just means a human inspector checks it again — far less dangerous.

---

### Phase 6 — Use best.pt in Your Application

Update `poc/backend/main.py` or wherever the engine is initialized:

```python
from inference import InferenceEngine

engine = InferenceEngine(
    model_path=r"D:\Automation\Vande Baharat\training_runs\vande_bharat_v1\weights\best.pt",
    use_stub=False   # ← switch this off
)
```

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `CUDA out of memory` | GPU RAM too small | Add `device=cpu` to train command, or reduce `batch=8` |
| `No labels found` | Label files in wrong folder | Check labels/ folder exists next to images/ |
| `Class index out of range` | nc in yaml doesn't match actual class IDs | Re-run verify_dataset.py, fix DEFECT_CLASS_NAMES |
| Loss stays at 0 or NaN | Corrupted labels | Check labels contain valid numbers only |
| `FileNotFoundError: data.yaml` | Wrong path | Use absolute paths, not relative |

---

## Summary: Decision Made and Why

```
12 datasets, inconsistent classes
            ↓
Binary approach: defect(0) / normal(1)
            ↓
Reasons:
  - Matches project spec (CLAUDE.md)
  - Maximizes recall (safety-critical)
  - Solves naming conflict automatically
  - Works with all 12 datasets
  - Simplest correct implementation
  - Upgradeable to multi-class in v2
            ↓
merge_datasets.py → merged_dataset/
            ↓
yolo train → training_runs/vande_bharat_v1/weights/best.pt
            ↓
Evaluate: target recall > 0.85
            ↓
Wire into poc/backend/inference.py
```

---

## After This Works — What's Next (v2)

Once binary model achieves >85% recall:

1. **Add defect subtypes:** Crack / Rusting / Deformation / Loose bolt / Missing bolt
2. **More data:** Use your feedback loop (already in `poc/backend/`) to capture hard cases
3. **Bigger model:** Upgrade `yolov8n.pt` → `yolov8s.pt` or `yolov8m.pt` for better accuracy
4. **Component context:** Add component-type classes so model says "Crack on Axle Box Cover"

---

*Last updated: 2026-05-06*
*Model: YOLOv8n — Transfer Learning — Binary Defect Detection*
