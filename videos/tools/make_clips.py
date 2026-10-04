#!/usr/bin/env python3
"""Cut the per-frame footage clips (trim, speed, baked push-in) for both reels.

Durations come from each project's STORYBOARD.md (`duration:` per frame), so after the
recorded voice-over re-times the frames, re-running this script re-cuts every clip to fit.
Output: <project>/assets/clips/<name>.mp4 — H.264, 1080x1920, 30fps, no audio.
"""
import pathlib
import re
import subprocess
import sys

VIDEOS = pathlib.Path(__file__).resolve().parent.parent
SRC = VIDEOS / "before-i-do-couples" / "assets" / "user"


def frame_durations(project):
    text = (VIDEOS / project / "STORYBOARD.md").read_text()
    out = {}
    for block in re.split(r"(?=^## Frame \d+)", text, flags=re.M)[1:]:
        n = int(re.match(r"## Frame (\d+)", block).group(1))
        out[n] = float(re.search(r"^- duration: ([\d.]+)s", block, flags=re.M).group(1))
    return out


def probe(path):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).decode())


def cut(src, dst, start, length, speed=1.0, push=0.0, hold_last=False):
    """Take `length` output seconds from `src` beginning at `start`, played at `speed`.

    push: total extra zoom over the clip (0.06 = 1.00 -> 1.06), baked in.
    hold_last: if the slowed source runs out, freeze its last frame to fill `length`.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    src_len = min(length * speed, probe(src) - start)
    vf = [f"trim=start={start}:duration={src_len:.3f}", "setpts=PTS-STARTPTS"]
    if speed != 1.0:
        vf += [f"setpts=PTS/{speed}", "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1"]
    if hold_last:
        vf.append(f"tpad=stop_mode=clone:stop_duration={length:.3f}")
    if push:
        z = f"(1+{push}*t/{length:.3f})"
        vf += [f"scale=w='2*trunc(540*{z})':h='2*trunc(960*{z})':eval=frame", "crop=1080:1920:(iw-1080)/2:(ih-1920)/2"]
    vf += ["fps=30", "format=yuv420p"]
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-an", "-vf", ",".join(vf),
                    "-t", f"{length:.3f}", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                    "-movflags", "+faststart", str(dst)], check=True)
    print(f"{dst.relative_to(VIDEOS)}  {probe(dst):.2f}s")


which = sys.argv[1:] or ["couples", "gift"]
if "couples" in which:
    d = frame_durations("before-i-do-couples")
    out = VIDEOS / "before-i-do-couples" / "assets" / "clips"
    cut(SRC / "clip-7319-box-table.mp4", out / "f1-table.mp4", 0, d[1], speed=2.867 / d[1], push=0.06)
    cut(SRC / "clip-7317-open-box-top.mp4", out / "f3-open-box.mp4", 1.0, d[3])
    split = round(d[4] * 0.355, 2)  # pill 03 / the cut lands on "ומדברים"
    cut(SRC / "clip-7318-pull-card.mp4", out / "f4a-pull-card.mp4", 2.6, split)
    cut(SRC / "clip-7298-hand-card.mp4", out / "f4b-hand-card.mp4", 0, d[4] - split, speed=0.6, hold_last=True)
if "gift" in which:
    d = frame_durations("before-i-do-gift")
    out = VIDEOS / "before-i-do-gift" / "assets" / "clips"
    cut(SRC / "clip-7317-open-box-top.mp4", out / "f2-open-box.mp4", 1.0, d[2])
