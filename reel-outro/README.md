# חתונה בלי פילטרים — Instagram Reel outro

A 4-second animated outro for Instagram Reels: 1080 × 1920, 30 fps, H.264 MP4.

A groom's shoe breaks the wedding glass. The burgundy shards come back together as **חתונה**, the red **בלי פילטרים** sticker lands on the word, and the host names appear. The last frame is the supplied logo on its own, with nothing else on screen.

Finished renders are in `export/`:

| File | What |
| --- | --- |
| `chatuna-bli-filterim-outro.mp4` | Delivery file. Silent, 120 frames, yuv420p, BT.709 |
| `chatuna-bli-filterim-outro-scratch-sfx.mp4` | The same picture with synthetic placeholder sounds at the sync markers. Use it to check timing, not for delivery |
| `final-frame.png` | The last frame (3.967 s), as a poster |
| `audio-markers.json` | Sync points for the sound designer |

## Structure

```
index.html        1080×1920 SVG stage. Each element is its own <g id="layer-…">
styles.css        brand colours (CSS variables) and preview UI
animation.js      CONFIG, the timeline, easing, and a pure renderAt(t)
assets/
  source/logo-reference.png   the supplied logo (never modified)
  layers/                     layers cut from it by tools/extract_layers.py
    word-mask.png             חתונה
    label-text-mask.png       בלי פילטרים lettering
    names-mask.png            עם עדן חיימוב וברק ליור
    geometry.json / .js       label corners, knockout width, rule lines, sampled colours
tools/
  extract_layers.py   splits the logo into layers
  render.mjs          frame-accurate capture (headless Chromium + FFmpeg)
```

SVG layers: `layer-glass`, `layer-groom` (containing `layer-leg` and `layer-shoe`), `layer-impact`, `layer-fragments`, `layer-word`, `layer-label`, `layer-names`.

### How the logo is used

The lettering is not redrawn or typeset. `extract_layers.py` pulls each part of the supplied PNG out of the pink background into an alpha mask, and the page fills those masks with the colours from `styles.css`. The label is a vector quad. Its corners were fitted to the logo's red edges to within 0.5 px, and it keeps the logo's 5.5 px paper-coloured knockout border. The two rule lines are vectors measured from the logo, which lets them draw outward.

The sticker hides the bottoms of three stems (both stems of ח and the right stem of ת). Those stems have to be visible while חתונה is on screen alone, so the extractor extends each one straight down to the shared baseline. When the sticker lands it covers exactly that area, so the final frame matches the reference pixel for pixel.

### How the shards become the word

חתונה is split into 16 triangles on a jittered grid with a fixed seed. Each triangle has two roles:

1. **Shard:** during the break it is a small solid burgundy triangle.
2. **Piece of the logo:** on the way back it grows, spins back to 0°, and fades from solid fill to its clipped piece of the real artwork.

Every triangle finishes in its exact place at 1.86 s. At that moment the fragment layer is swapped for the full word layer, and the two look identical.

## Adjusting

**Colours:** edit `:root` in `styles.css`. The defaults are sampled from the logo. The written brief's palette (#F4D4D2 / #72151C / #B8142C / #FFF4E9) is also included. Turn it on with `?palette=brief`, `CONFIG.palette = 'brief'`, or `node tools/render.mjs --palette brief`.

**Everything else:** the `CONFIG` object at the top of `animation.js`:

| Setting | Controls |
| --- | --- |
| `duration` | Total length. The whole timeline stretches to fit, and the frame count follows |
| `timeline.impact` | Glass impact. The stomp, burst and shoe exit move with it |
| `timeline.*` | Timing of each scene, in seconds on a 4 s timeline |
| `logo.scale` | Size of the lockup (0.84 makes it 840 px wide) |
| `logo.centerY` / `centerX` | Position of the lockup |
| `glass.*`, `groom.scale` | Size and position of the illustration |
| `fragments.count/seed` | Shard layout (fixed seed, so it is the same on every render) |
| `audioMarkers` | Sync points, exported to JSON |

## Preview

Open `index.html` in Chrome, either directly from disk or through a server (`npx http-server .`).

- The preview loops. Between loops it fades back to the pink background; this fade is preview-only and never appears in the export.
- The controls bar has play/pause, a frame scrubber and a one-frame step.
- **IG guides** overlays the Instagram interface zones. The lockup sits clear of all of them.
- URL parameters: `?t=2.42` freezes on a time, `?guides=1` shows the zones, `?palette=brief` switches palettes.

## Export (1080 × 1920, 30 fps, 4 s, MP4 H.264)

Requires Node 18+, FFmpeg, and either Puppeteer or Playwright.

```bash
npm install                      # installs puppeteer (downloads its own Chromium)
npm run render                   # → out/outro.mp4 + out/outro-final-frame.png + markers
npm run render -- --sfx          # also out/outro-sfx.mp4 with scratch sound
npm run render -- --frames       # also keep the PNG sequence in out/frames/
```

The page is loaded with `?render=1`, which turns off playback. The script then calls `OUTRO.renderAt(i / 30)` for frames 0–119, screenshots each one at 1080×1920 (device scale factor 1), and pipes them to FFmpeg: `libx264 -profile high -crf 16 -preset slow`, yuv420p, BT.709 tags, `+faststart`.

Timing is computed from the frame number, so machine speed has no effect. Two renders on the same machine produce byte-identical MP4s. If Puppeteer is not installed, the script uses Playwright instead. Set `CHROME_PATH` to point either one at a particular Chromium.

To capture the frames another way, drive `window.OUTRO` directly: `await OUTRO.ready`, then call `OUTRO.renderFrame(i)` and capture.

## Timeline

| Time | Event |
| --- | --- |
| 0.00–0.10 | Empty pink background |
| 0.06–0.42 | The glass draws in as thin wine line art |
| 0.10–0.50 | The trouser leg and shoe come down from the top |
| 0.50–0.64 | Small lift before the stomp |
| 0.64–0.72 | Stomp, speeding up into the glass |
| **0.72** | **Impact.** 3.5 % scale punch, impact strokes, 16 shards fly out |
| 0.72–0.86 | The shoe presses and grinds |
| 0.86–1.12 | The shoe leaves through the top of the frame |
| 1.02–1.15 | The shards hold still |
| **1.15**–1.86 | Shards travel on curved paths, spin and grow into חתונה; start times vary but all finish together |
| **1.90** | חתונה complete |
| 2.14 → **2.20** | The sticker enters from the lower left and crosses the frame edge |
| **2.42** | The sticker lands with a slight overshoot; the word under it gets a 3 px nudge |
| 2.42–2.56 | Small counter-rotation, then it settles |
| 2.60–2.92 (**2.75**) | Names fade in and rise 10 px |
| 2.64–3.04 | The rule lines draw outward from the names |
| 3.10–4.00 | The complete lockup holds |

Audio markers from the brief: 0.72 glass crack · 1.15 shards start moving · 1.90 word complete · 2.20 sticker enters · 2.42 sticker slap · 2.75 names and final click. No music.

## Re-extracting the layers

To use a new master of the logo, replace `assets/source/logo-reference.png` and run:

```bash
pip install pillow numpy
python3 tools/extract_layers.py
```

The label corners (`QUAD`) and crop box are constants in that script. If the new artwork's layout is different, re-fit them.

## Intro version with music (8 s)

`export/chatuna-bli-filterim-INTRO-with-music.mp4` opens with "Here Comes the Bride" on a synthesised organ (Wagner, 1850, public domain) while the glass draws in. As the shoe winds up, the organ slows to a stop. The glass smash lands where the word "white" should be, and a 125 bpm beat drops (4.16 s). The sticker lands on a clap (6.08 s), and the melody's last note arrives on the final hit (7.52 s).

```bash
python3 tools/make_soundtrack.py          # → export/intro-soundtrack.wav / .m4a
node tools/render.mjs --version intro --audio export/intro-soundtrack.wav
```

Preview it with `index.html?version=intro`. Its timing lives in `CONFIG.introTimeline`.
