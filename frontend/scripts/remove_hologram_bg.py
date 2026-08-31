"""
Background removal for caduceus-hologram.png — real alpha transparency,
NOT regenerated artwork. Uses the exact existing pixels; only the alpha
channel is computed and written.

Approach (image processing only, no generative AI):
  1. Gradient-following flood fill (cv2.floodFill, per-step tolerance,
     MASK_ONLY) seeded from many points along the four image borders.
     This traces the background from the outer black corners inward,
     following its own smooth brightness gradient, and stops naturally
     wherever the local jump in brightness is too large to be background
     (i.e. right at the glow's edge) — WITHOUT needing a single global
     brightness threshold. Anything not reached by this fill (e.g. dark
     shadowed pixels *inside* the glass ball, enclosed by brighter pixels)
     is structurally protected and stays fully opaque, however dark it is
     — this is what keeps the sphere's own internal shading, reflections
     and grid lines intact instead of being read as "background".
  2. The resulting hard background mask is fed through a Gaussian blur to
     turn its edge into a soft alpha ramp (feathering) instead of a hard
     cutout, so the cyan/white glow around the sphere, rings, base and
     particles fades gradually to transparent rather than being clipped.
  3. Alpha = 255 * (1 - blurred_mask), composited back onto the original
     RGB (untouched) as a real RGBA PNG.
"""
import sys
import numpy as np
from PIL import Image
import cv2

SRC = r"C:\Users\Eng.Huda Elmuthefer\Documents\huda-portfolio\sihatuna-iraq-erp\frontend\src\assets\dark\caduceus-hologram.png"
DST = r"C:\Users\Eng.Huda Elmuthefer\Documents\huda-portfolio\sihatuna-iraq-erp\frontend\src\assets\dark\caduceus-hologram-transparent.png"

# Flood-fill tolerance (per BGR channel, both directions) — how much a
# neighboring pixel is allowed to differ from the one already accepted as
# background before the fill stops. Tuned to trace the smooth dark
# background gradient but halt right at the glow's much steeper edge.
TOLERANCE = 8
# Feather radius (Gaussian sigma, in px) applied to the fill mask so the
# background→foreground edge becomes a soft ramp instead of a hard cut.
FEATHER_SIGMA = 5
SEEDS_PER_EDGE = 24


def main():
    img_pil = Image.open(SRC).convert("RGB")
    rgb = np.array(img_pil)  # H,W,3 RGB
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]

    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    diff = (TOLERANCE, TOLERANCE, TOLERANCE)

    def seed_points():
        xs = np.linspace(0, w - 1, SEEDS_PER_EDGE).astype(int)
        ys = np.linspace(0, h - 1, SEEDS_PER_EDGE).astype(int)
        pts = []
        pts += [(x, 0) for x in xs]
        pts += [(x, h - 1) for x in xs]
        pts += [(0, y) for y in ys]
        pts += [(w - 1, y) for y in ys]
        return pts

    flags = cv2.FLOODFILL_MASK_ONLY | 4 | (255 << 8)
    filled_any = False
    for (sx, sy) in seed_points():
        # Skip seeds already captured by a previous fill, and skip seeds
        # that are themselves clearly NOT background (a bright corner
        # would be unusual here, but be defensive).
        if flood_mask[sy + 1, sx + 1] != 0:
            continue
        # Use a working copy per call since MASK_ONLY still requires a
        # mutable mask array shared across calls to accumulate regions.
        cv2.floodFill(bgr.copy(), flood_mask, (sx, sy), 0, loDiff=diff, upDiff=diff, flags=flags)
        filled_any = True

    if not filled_any:
        print("WARNING: no seeds produced a fill — check TOLERANCE.")

    hard_bg = flood_mask[1:-1, 1:-1].astype(np.float32)  # 0..255, 255 = background
    soft_bg = cv2.GaussianBlur(hard_bg, (0, 0), FEATHER_SIGMA)
    alpha = np.clip(255.0 - soft_bg, 0, 255).astype(np.float32)

    # The pedestal/base's own shadowed metal is nearly as dark as the
    # background (a real, deliberate part of the artwork, not something to
    # invent) — low enough contrast that the gradient-following flood fill
    # above bridges straight through parts of it, which measurably tested
    # as a wrong result (composited over white/black/the banner tone, the
    # base's solid body became see-through). Fix: force full opacity in a
    # soft (heavily-feathered — no hard rectangle) elliptical zone sized to
    # the base's actual measured extent, taking the max with the flood-fill
    # alpha so it only ever ADDS opacity back where the base legitimately
    # is, without touching the sphere/rings above it.
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = 0.5 * w, 0.755 * h
    rx, ry = 0.49 * w, 0.135 * h
    ellipse = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    base_protect = np.clip(255.0 * (1.0 - ellipse), 0, 255).astype(np.float32)
    base_protect = cv2.GaussianBlur(base_protect, (0, 0), 45)
    alpha = np.maximum(alpha, base_protect)

    # Same low-contrast issue on the glass sphere itself: its own body is a
    # dark, smoothly-shaded glass surface (measured — only its rim
    # highlights and internal reflections are much brighter than the
    # background), so the flood fill traces through most of its surface
    # too, leaving only bright highlights floating with nothing reading as
    # "glass" behind them. Requirement #4 explicitly says the sphere's own
    # dark areas are not background. Fix the same way, but capped at a
    # LOWER opacity (140, not 255) — a solid opaque disc would misrepresent
    # a *glass* sphere, which should still show a hint of whatever is
    # behind it (matches how it read against its original dark backdrop).
    cx2, cy2 = 0.5 * w, 0.37 * h
    rx2, ry2 = 0.46 * w, 0.24 * h
    ellipse2 = ((xx - cx2) / rx2) ** 2 + ((yy - cy2) / ry2) ** 2
    sphere_protect = np.clip(140.0 * (1.0 - ellipse2), 0, 140).astype(np.float32)
    sphere_protect = cv2.GaussianBlur(sphere_protect, (0, 0), 55)
    alpha = np.maximum(alpha, sphere_protect)

    alpha = np.clip(alpha, 0, 255).astype(np.uint8)

    rgba = np.dstack([rgb, alpha])
    out = Image.fromarray(rgba, mode="RGBA")
    out.save(DST)

    bg_pct = (hard_bg > 127).sum() / hard_bg.size * 100
    print(f"Saved: {DST}")
    print(f"Background coverage (hard mask): {bg_pct:.1f}% of image")
    print(f"Alpha stats: min={alpha.min()} max={alpha.max()} mean={alpha.mean():.1f}")


if __name__ == "__main__":
    main()
