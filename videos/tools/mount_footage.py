#!/usr/bin/env python3
"""Mount the per-frame footage clips UNDER the frame overlays in an assembled index.html.

assemble-index.mjs hoists approved frame videos above the frames (DOM order) and drops
playback-rate, so the reels keep footage out of the frames and mount it here instead:
each clip is a muted full-bleed <video class="clip"> placed before the scenes, and scenes
get a higher z-index. Idempotent: re-run after every assemble-index.mjs.

Usage: mount_footage.py <couples|gift>
"""
import pathlib
import re
import sys

VIDEOS = pathlib.Path(__file__).resolve().parent.parent
variant = sys.argv[1]
proj = VIDEOS / f"before-i-do-{variant}"
index = proj / "index.html"
html = index.read_text()

scenes = {m.group(1): (float(m.group(2)), float(m.group(3))) for m in re.finditer(
    r'data-composition-id="([^"]+)"\s+data-composition-src="[^"]+"\s+data-start="([\d.]+)"\s+data-duration="([\d.]+)"', html)}

# (frame id, clip, offset within frame, length) — offsets/lengths mirror make_clips.py
if variant == "couples":
    s4, d4 = scenes["04-play"]
    split = round(d4 * 0.355, 2)
    mounts = [("01-hook", "f1-table.mp4", 0, scenes["01-hook"][1]),
              ("03-product", "f3-open-box.mp4", 0, scenes["03-product"][1]),
              ("04-play", "f4a-pull-card.mp4", 0, split),
              ("04-play", "f4b-hand-card.mp4", split, d4 - split)]
else:
    mounts = [("02-reveal", "f2-open-box.mp4", 0, scenes["02-reveal"][1])]

html = re.sub(r"\n\s*<!-- footage:begin -->.*?<!-- footage:end -->", "", html, flags=re.S)
lines = ["      <!-- footage:begin -->"]
for i, (fid, clip, off, length) in enumerate(mounts):
    start = round(scenes[fid][0] + off, 3)
    lines.append(
        f'      <video id="footage-{i + 1}" class="clip footage" src="assets/clips/{clip}" muted playsinline '
        f'data-start="{start}" data-duration="{round(length, 3)}" data-track-index="{3 + i % 2}"></video>')
lines.append("      <!-- footage:end -->")
html = html.replace('      <div\n        id="el-', "\n".join(lines) + '\n      <div\n        id="el-', 1)

css = """      .footage {
        position: absolute;
        inset: 0;
        width: 1080px;
        height: 1920px;
        object-fit: cover;
        z-index: 0;
      }
      .scene { z-index: 1; }
"""
if ".footage {" not in html:
    html = html.replace("    </style>\n  </head>", css + "    </style>\n  </head>", 1)
index.write_text(html)
print(f"mounted {len(mounts)} clip(s) into {index.relative_to(VIDEOS)}")
