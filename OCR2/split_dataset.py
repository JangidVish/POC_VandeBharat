import os
import shutil
import random

def split_dataset(base_dir, train_ratio=0.8):
    images_dir = os.path.join(base_dir, 'images')
    labels_dir = os.path.join(base_dir, 'labels')
    
    train_images_dir = os.path.join(base_dir, 'train', 'images')
    train_labels_dir = os.path.join(base_dir, 'train', 'labels')
    val_images_dir = os.path.join(base_dir, 'val', 'images')
    val_labels_dir = os.path.join(base_dir, 'val', 'labels')
    
    # Create directories
    for d in [train_images_dir, train_labels_dir, val_images_dir, val_labels_dir]:
        os.makedirs(d, exist_ok=True)
        
    # Get all image files
    image_files = [f for f in os.listdir(images_dir) if f.endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    
    # Filter only those that have corresponding label files
    valid_pairs = []
    for img_file in image_files:
        base_name = os.path.splitext(img_file)[0]
        label_file = base_name + '.txt'
        if os.path.exists(os.path.join(labels_dir, label_file)):
            valid_pairs.append((img_file, label_file))
        else:
            print(f"Warning: No label found for {img_file}")
            
    # Shuffle and split
    random.seed(42)
    random.shuffle(valid_pairs)
    
    split_idx = int(len(valid_pairs) * train_ratio)
    train_pairs = valid_pairs[:split_idx]
    val_pairs = valid_pairs[split_idx:]
    
    print(f"Found {len(valid_pairs)} valid image-label pairs.")
    print(f"Splitting into {len(train_pairs)} training and {len(val_pairs)} validation pairs.")
    
    # Move files
    def move_pairs(pairs, dest_images_dir, dest_labels_dir):
        for img_file, label_file in pairs:
            # Move image
            src_img = os.path.join(images_dir, img_file)
            dst_img = os.path.join(dest_images_dir, img_file)
            shutil.move(src_img, dst_img)
            
            # Move label
            src_lbl = os.path.join(labels_dir, label_file)
            dst_lbl = os.path.join(dest_labels_dir, label_file)
            shutil.move(src_lbl, dst_lbl)
            
    move_pairs(train_pairs, train_images_dir, train_labels_dir)
    move_pairs(val_pairs, val_images_dir, val_labels_dir)
    
    print("Done moving files.")
    
    # Optional: remove original directories if empty
    if not os.listdir(images_dir):
        os.rmdir(images_dir)
    if not os.listdir(labels_dir):
        os.rmdir(labels_dir)

if __name__ == '__main__':
    base_dir = r"e:\PROJECTS\VandeBharat\OCR\OCR FRAMES.yolov8"
    split_dataset(base_dir)
