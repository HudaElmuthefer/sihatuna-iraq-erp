"""
Background removal for the 4 light-mode dashboard stat-tile icons (calendar,
warehouse, documents, folder/projects) supplied in components/light. Same
gradient-following flood-fill approach already proven on the dark-mode stat
icons (frontend/scripts/remove_stat_icon_bg.py) and the hero hologram
(remove_hologram_bg.py): traces the studio backdrop from the border inward
regardless of local brightness, instead of a single global threshold that
can leave semi-opaque corner patches (that exact bug was the "black box
behind the icon" issue fixed for dark mode).

Originals are left untouched; cleaned copies are written to
components/light/processed/ per the task's explicit instruction, separate
from frontend/src/assets/light/ (the actual runtime copies, created after
visually verifying these).
"""
import numpy as np
from PIL import Image
import cv2

SRC_DIR = r"C:\Users\Eng.Huda Elmuthefer\Documents\huda-portfolio\sihatuna-iraq-erp\components\light"
DST_DIR = r"C:\Users\Eng.Huda Elmuthefer\Documents\huda-portfolio\sihatuna-iraq-erp\components\light\processed"

ICONS = {
    "ChatGPT Image Aug 30, 2026, 05_23_12 PM (2).png": "calendar-transparent.png",
    "ChatGPT Image Aug 30, 2026, 05_23_13 PM (3).png": "warehouse-transparent.png",
    "ChatGPT Image Aug 30, 2026, 05_23_13 PM (4).png": "documents-transparent.png",
    "ChatGPT Image Aug 30, 2026, 05_23_14 PM (6).png": "projects-transparent.png",
}

TOLERANCE = 10
FEATHER_SIGMA = 3
SEEDS_PER_EDGE = 32


def process(src_name, dst_name):
    src = f"{SRC_DIR}\\{src_name}"
    dst = f"{DST_DIR}\\{dst_name}"

    img_pil = Image.open(src).convert("RGB")
    rgb = np.array(img_pil)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]

    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    diff = (TOLERANCE, TOLERANCE, TOLERANCE)
    flags = cv2.FLOODFILL_MASK_ONLY | 4 | (255 << 8)

    xs = np.linspace(0, w - 1, SEEDS_PER_EDGE).astype(int)
    ys = np.linspace(0, h - 1, SEEDS_PER_EDGE).astype(int)
    seeds = [(x, 0) for x in xs] + [(x, h - 1) for x in xs] + \
            [(0, y) for y in ys] + [(w - 1, y) for y in ys]

    for (sx, sy) in seeds:
        if flood_mask[sy + 1, sx + 1] != 0:
            continue
        cv2.floodFill(bgr.copy(), flood_mask, (sx, sy), 0, loDiff=diff, upDiff=diff, flags=flags)

    hard_bg = flood_mask[1:-1, 1:-1].astype(np.float32)
    soft_bg = cv2.GaussianBlur(hard_bg, (0, 0), FEATHER_SIGMA)
    alpha = np.clip(255.0 - soft_bg, 0, 255).astype(np.uint8)

    rgba = np.dstack([rgb, alpha])
    Image.fromarray(rgba, mode="RGBA").save(dst)

    bg_pct = (hard_bg > 127).sum() / hard_bg.size * 100
    corner_alphas = [alpha[2, 2], alpha[2, w - 3], alpha[h - 3, 2], alpha[h - 3, w - 3]]
    print(f"{dst_name}: bg={bg_pct:.1f}%  corner alphas={list(corner_alphas)}")


for src_name, dst_name in ICONS.items():
    process(src_name, dst_name)
