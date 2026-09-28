#!/usr/bin/env python3
"""
Split the supplied logo (assets/source/logo-reference.png) into the
animation layers used by the outro. Nothing is redrawn: every mask below is
the logo's own pixels, un-mixed from the paper colour into an alpha channel
so the colours can be driven by CSS variables.

Outputs (all share one crop box, so they stack at the same x/y):
  assets/layers/word-mask.png         חתונה  (white = ink)
  assets/layers/label-text-mask.png   בלי פילטרים lettering inside the label
  assets/layers/names-mask.png        עם עדן חיימוב וברק ליור
  assets/layers/geometry.json         label quad, knockout width, rule lines,
                                      crop box and sampled brand colours

The red label hides the bottom of three stems (ח ×2, ת). For the moment the
word stands alone we rebuild those stems by extending each hidden column
straight down to the letters' shared baseline. Once the label lands it covers
exactly the reconstructed area again, so the finished lockup is pixel-true.

Usage:  python3 tools/extract_layers.py
Needs:  pillow, numpy
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "source", "logo-reference.png")
OUT = os.path.join(ROOT, "assets", "layers")

# Crop box (source px) that contains the full lockup with breathing room.
CROP = (250, 190, 1290, 860)  # x0, y0, x1, y1

# Label quad, fitted to the red edges with a robust line fit (<0.5 px error).
# Order: top-left, top-right, bottom-right, bottom-left (source px).
QUAD = [(378.47, 630.21), (1211.13, 490.08), (1244.05, 659.59), (409.21, 783.86)]
# Paper-coloured knockout between the label and the letters it overlaps.
KNOCKOUT = 5.5

# Baseline of the hidden stems (bottom of the visible ח foot) and the
# column range in which stems disappear under the label.
STEM_BASELINE = 556.5
STEM_X_RANGE = (900, 1262)

# Rows that belong to the host-names line.
NAMES_Y = 790


def signed_distance(shape, poly):
    """Distance to a convex polygon (positive outside, negative inside)."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    d = np.full(shape, -1e9)
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        ex, ey = x2 - x1, y2 - y1
        length = np.hypot(ex, ey)
        nx, ny = ey / length, -ex / length  # outward for clockwise (y-down)
        d = np.maximum(d, (xx - x1) * nx + (yy - y1) * ny)
    return d


def clean(alpha, lo=0.04, hi=0.96):
    return np.clip((alpha - lo) / (hi - lo), 0, 1)


def save_mask(alpha, name):
    x0, y0, x1, y1 = CROP
    img = Image.fromarray((alpha[y0:y1, x0:x1] * 255 + 0.5).astype(np.uint8), "L")
    img.save(os.path.join(OUT, name), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    rgb = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
    r, g = rgb[..., 0], rgb[..., 1]
    h, w = g.shape

    paper = np.median(rgb[(r > 245) & (g > 215)], axis=0)
    wine = np.median(rgb[(r < 140) & (g < 40)], axis=0)
    dist = signed_distance((h, w), QUAD)
    cherry = np.median(rgb[(dist < -3) & (r > 140) & (g < 30)], axis=0)

    # Green separates paper (G≈226) from both wine (G≈4) and cherry (G≈7).
    ink = clean((paper[1] - g) / (paper[1] - wine[1]))

    # ---- חתונה ---------------------------------------------------------
    word = ink.copy()
    word[NAMES_Y:, :] = 0
    under = dist < KNOCKOUT + 0.5          # label + knockout ring
    word[under] = 0
    # Rebuild hidden stems: sample the ink just above the ring and carry it
    # down to the baseline, anti-aliasing the flat end.
    ys = np.arange(h)
    for x in range(*STEM_X_RANGE):
        col_under = np.nonzero(under[:, x])[0]
        if len(col_under) == 0:
            continue
        top = col_under[0]
        if top >= STEM_BASELINE - 1:
            continue
        a = ink[top - 2, x]
        if a <= 0:
            continue
        cover = np.clip(STEM_BASELINE - ys, 0, 1)  # partial last row
        span = (ys >= top - 2) & (ys < STEM_BASELINE + 1)
        word[span, x] = np.maximum(word[span, x], a * cover[span])
    save_mask(word, "word-mask.png")

    # ---- בלי פילטרים lettering (paper-coloured cut-outs in the label) ----
    text = clean((g - cherry[1]) / (paper[1] - cherry[1]))
    text[dist > -2.5] = 0
    save_mask(text, "label-text-mask.png")

    # ---- names (rule lines are drawn as vectors, so blank them here) ------
    names = ink.copy()
    names[:NAMES_Y, :] = 0
    names[dist < KNOCKOUT + 0.5] = 0
    names[:, :400] = 0
    names[:, 1140:] = 0
    save_mask(names, "names-mask.png")

    # ---- rule lines -----------------------------------------------------
    rows = ink[NAMES_Y:, :]
    lines = []
    for xa, xb in ((0, 400), (1140, w)):
        band = rows[:, xa:xb]
        prof = band.sum(axis=1)
        yrows = np.nonzero(prof > prof.max() * 0.25)[0]
        y_c = float((yrows * prof[yrows]).sum() / prof[yrows].sum()) + NAMES_Y
        thickness = float(band[yrows].sum() / max(1, (band[yrows].max(axis=0) > 0.5).sum()))
        cols = np.nonzero(band[yrows].max(axis=0) > 0.5)[0] + xa
        lines.append({"x1": float(cols.min()), "x2": float(cols.max() + 1),
                      "y": round(y_c + 0.5, 2), "thickness": round(thickness, 2)})

    x0, y0, x1, y1 = CROP
    # Bounding box of the finished lockup (all ink + label), for centring.
    lock = (ink[y0:y1, x0:x1] > 0.2) | (dist[y0:y1, x0:x1] < 0)
    ly, lx = np.nonzero(lock)
    hexc = lambda c: "#%02X%02X%02X" % tuple(int(round(v)) for v in c)
    geo = {
        "source": "assets/source/logo-reference.png",
        "crop": {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0},
        "note": "All coordinates below are relative to the crop box.",
        "lockupBox": {"x": int(lx.min()), "y": int(ly.min()),
                      "width": int(lx.max() - lx.min() + 1), "height": int(ly.max() - ly.min() + 1)},
        "labelQuad": [[round(px - x0, 2), round(py - y0, 2)] for px, py in QUAD],
        "knockout": KNOCKOUT,
        "rules": [{**l, "x1": l["x1"] - x0, "x2": l["x2"] - x0, "y": round(l["y"] - y0, 2)} for l in lines],
        "sampledColors": {"paper": hexc(paper), "wine": hexc(wine),
                          "cherry": hexc(cherry), "labelText": hexc(paper)},
    }
    with open(os.path.join(OUT, "geometry.json"), "w") as f:
        json.dump(geo, f, indent=2)
    # Same data as a script so index.html also works straight from file://
    with open(os.path.join(OUT, "geometry.js"), "w") as f:
        f.write("// Generated by tools/extract_layers.py - do not edit by hand.\n")
        f.write("window.OUTRO_GEOMETRY = " + json.dumps(geo, indent=2) + ";\n")
    print(json.dumps(geo, indent=2))


if __name__ == "__main__":
    main()
