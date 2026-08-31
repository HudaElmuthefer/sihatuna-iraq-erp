"""
Robust background removal for the 4 dashboard stat-tile icons (documents,
projects, calendar, warehouse). Replaces make-icons-transparent.ps1's global
per-pixel luminance threshold (24..52), which left visible semi-opaque dark
corner patches on calendar/warehouse because those two source renders have
studio-backdrop corners whose luminance (~35-37) falls inside that
transitional band while documents/projects happened to sit below it
everywhere -- an accident of each render, not a real distinction between the
icons. This script uses the SAME gradient-following flood fill already
proven on the hero hologram (frontend/scripts/remove_hologram_bg.py):
connectivity-based, so it fully clears the backdrop+floor regardless of
local brightness variation, instead of an arbitrary global cutoff.

Approach per icon:
  1. Flood-fill (cv2.floodFill, MASK_ONLY, per-step tolerance) seeded from
     many points along all four borders -- traces the backdrop/floor's own
     smooth gradient from the outside in, stopping naturally at the sharp
     jump into the glass plate's bright edge-highlight (no global threshold
     needed).
  2. Feather the resulting mask (Gaussian blur) so the cut is a soft ramp,
     not a hard edge.
  3. Alpha = 255 * (1 - blurred_mask), composited onto the original RGB.
"""
import numpy as np
from PIL import Image
import cv2

DIR = r"C:\Users\Eng.Huda Elmuthefer\Documents\huda-portfolio\sihatuna-iraq-erp\frontend\src\assets\dark"
ICONS = ["icon-documents", "icon-projects", "icon-calendar", "icon-warehouse"]

TOLERANCE = 10
FEATHER_SIGMA = 3
SEEDS_PER_EDGE = 32


def process(name):
    src = f"{DIR}\\{name}.png"
    dst = f"{DIR}\\{name}-transparent.png"

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
    print(f"{name}: bg={bg_pct:.1f}%  corner alphas={list(corner_alphas)}")


for icon in ICONS:
    process(icon)
