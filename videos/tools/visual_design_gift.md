@@VIDEO_DIRECTION
## Video direction

- **Palette (frame.md roles):** brand blue `primary` #4F6BA5 as the hook field and for pills/stat; canvas white / `canvas-alt` #F1F4F9 for light frames; `ink-deep` #1F2C4A for headlines on light and for footage-dimming gradients; `tint` #DDE7F5 for chat bubbles and secondary pills; `heart` #EF453D is the ONE accent — strike-throughs, underlines, the heart mark, the bonus pill and the gift tag.
- **Type:** Assistant 700 headlines, Assistant 600 pills/labels; Caveat 600 ONLY for the "Before I Do" wordmark (LTR, red heart after "Do"). Hebrew text RTL, right-aligned unless the sketch centers it.
- **Canvas & safe zones (1080×1920 Reels):** key content between y≈190 and y≈1180. Caption band y≈1190–1345 stays clear on frames 1–4 (frame 5 has no captions and may use it). Below y≈1345 only footage/photo. From y≈1020 down, keep text out of the right ~120px (Instagram action buttons).
- **Motion grammar:** comedic timing — slightly snappier than the couples cut (`expo.out` arrivals, `power3` settles); small playful overshoot is allowed on the heart and the strike-through "pop" only. Every reveal lands on its spoken cue; first motion within 0.1s; something new every ~0.7–1.0s in frames 1–4 (retention), frame 5 lands and holds.
- **Direction rule:** horizontal motion right → left (Hebrew reading direction); strike-throughs and underlines draw right → left.
- **Rhythm / stillness:** frames 1–4 keep a quick beat; frame 5 is the held end card (clean loop point).
- **Timing hooks:** durations are estimates until the user's recorded VO arrives; every frame keeps its cue times in one `CUES` object at the top of its script.
- **Negative list:** no glow/bloom halos, no heavy drop shadows, no emoji glyphs (inline SVG only), no fake product UI, no lazy breathing, no back-half text pans, no elastic/bounce as a default, no slideshow, no screensaver, no CSS transitions/keyframes, no repeat/yoyo, no randomness.

@@1
- blueprint: kinetic-type-beats (Adapt)
- focal: none (typography frame)
- roles: none
- sfx: none
- cues: "החברים התארסו" 0.05 · "מגיעה להם מתנה" 1.1 · "אז..." 2.2 · "עוד סט מצעים" 2.7 · "מסגרת עם השמות" 3.8 · end 5.0

Adapt: sub-shape A (fixed slot, token cycle) — one center slot rolls through the cliché gifts like a slot machine (`vertical-spring-ticker`), each option crossed out as soon as it's said; keep the signature in-place swap. Ghost neighbours above/below show the "endless list".
Scene 1 (0.0–1.1s): solid brand-blue field (full-bleed clip layer); "החברים התארסו" (white 600 ~76px, y≈180, right) types on quickly (`discrete-text-sequence`, smooth form) and a small red heart pops after it (playful overshoot).
Scene 2 (1.1–2.1s): "מגיעה להם מתנה. אז..." (white 400 ~58px, 85% opacity) reveals per word beneath.
Scene 3 (2.2–2.7s): the slot column appears (centered on y≈570): faint ghost options "מגבות עם רקמה?" above and "מסגרת עם השמות?" below (white 700 ~86px at 28% opacity), center slot empty for the "אז..." beat.
Scene 4 (2.7–3.8s): center slot rolls up to "עוד סט מצעים?" (white 700 ~135px); at the end of the phrase a heart-red strike-through draws right→left across it with a tiny snap (`css-marker-patterns`, strike).
Scene 5 (3.8–5.0s): the ticker rolls one step — the struck "עוד סט מצעים?" moves up to ghost position (keeping its strike), "מסגרת עם השמות?" rolls into the center slot and gets its own strike on cue; a new ghost "מגבות עם רקמה?" slides into the lower slot. Hold.

@@2
- blueprint: ticker-takeover (Adapt)
- focal: assets/user/clip-7317-open-box-top.mp4
- roles: clip-7317-open-box-top = background (full-bleed, data-media-start 1.0, deep-ink gradient on the top ~60%)
- sfx: none
- cues: "עם כל הכבוד" 0.05 · "זו המתנה" 1.6 · "אשכרה" 2.6 · "עכשיו" 3.4 · end 4.5

Adapt: the "hero crashes in" collision becomes the product footage arriving through the zoom-through seam with momentum (injected transition) — inside the frame the signature lands as the heavy slam of the hero word "אשכרה"; keep it a collision, not a fade.
Scene 1 (0.0–1.5s): footage full-bleed (hand opens the box), small ink-deep → transparent gradient on top; "עם כל הכבוד למצעים..." (white 600 ~65px, y≈180) types on with a wry pace (`discrete-text-sequence`).
Scene 2 (1.6–2.6s): "זו המתנה שהם" (white 700 ~119px, y≈300) reveals per word.
Scene 3 (2.6–3.4s): "אשכרה" SLAMS in (`kinetic-beat-slam`: arrives oversized with motion-blur, lands heavy on a long settle) and a heart-red underline sweeps right→left under it; "צריכים" follows.
Scene 4 (3.4–4.5s): "עכשיו." lands; hold with subtle jitter only.

@@3
- blueprint: kinetic-type-beats (Adapt)
- focal: capture/assets/37-ef04c4.webp
- roles: 37-ef04c4 (dog card) = cutout hero (front, right) · card-back-46f7ecfe-143643 = supporting (behind, left, tilted) · clip-7298-hand-card = dropped from the build (the approved sketch keeps the two cards as the landed state)
- sfx: none
- cues: "להביא את הכלב" 0.05 · "או להשאיר" 1.4 · "שבעים שאלות" 2.7 · "בסלון" 4.4 · "מול הספק" 5.2 · end 6.0

Adapt: a product-intro beat where the payload is a non-text center-stage element (the real card) obeying arrive → act → hold; keep the signature accent move on the key word ("או") and add the card flip as this frame's hero move. "Their words" layer: the closing joke becomes two chips — "בסלון" ✓ and "מול הספק" ✗ — the couple's real choice of venue for the argument.
Scene 1 (0.0–1.4s): light `canvas-alt` field; a single card shown from its back (the fingerprint-heart back) sits center; on "להביא את הכלב" it flips in 3D (rotateY 180°, `split-tilt-cards` mechanics for the tilt) revealing the dog card face, settling at the sketch's front-right anchor (x≈346–886, y≈410–1140, rotated +5°).
Scene 2 (1.4–2.6s): a second card back slides in behind it to the left (rotated −10°, sketch anchor) as "או להשאיר" is spoken; a heart-red circle marker hand-draws around the card's printed "או" (`css-marker-patterns`, circle).
Scene 3 (2.7–3.9s): top-right counter "70" (blue 700 ~162px, y≈130) counts up 0→70 (`counting-dynamic-scale`) with label "קלפים כאלה" (ink-deep 600 ~65px) revealing beside it.
Scene 4 (3.9–6.0s): two chips pop in under the counter row's level on the left side, above the caption band (y≈1060–1170, kept left of x≈940): "בסלון" with a blue check icon (inline SVG) on its cue, then "מול הספק" which gets a heart-red strike and a red ✕ icon on its cue. Hold.

@@4
- blueprint: compose
- focal: none (the chat-bubble stack is the hero; pure DOM + inline SVG)
- roles: none
- sfx: none
- cues: "והבונוס שלכם" 0.05 · bubbles 0.4 · "פחות" 1.1 · "סידורי הושבה" 2.3 · end 4.0

Compose — a fast comedic build. Bubbles are a generic chat metaphor (no product UI), tint fill, ink-deep text, inline-SVG microphone + a short waveform bar group.
Scene 1 (0.0–1.0s): white field; heart-red pill "והבונוס שלכם?" slides in from the right edge to y≈180 (`expo.out`).
Scene 2 (0.4–1.4s): voice-note bubbles pop in rapid-fire, stacked left-aligned with the sketch's offsets (y≈330, 450, 570): "0:47 · סידורי הושבה", "1:32 · השולחן של הדודים", "2:05 · ובן הדוד מחו״ל?" — each with its waveform bars growing in left→right on entry (`svg-icon-enrichment`, finite) and a small pop (`spring-pop-entrance`).
Scene 3 (1.1–2.3s): on "פחות" the stack gets swiped: the bubbles compress slightly and dim, the third fades to ~40% (sketch landed state), and a heart-red strike line sweeps right→left across the whole stack; the headline "פחות הודעות קוליות" (ink-deep 700 ~104px, y≈780) reveals per word.
Scene 4 (2.3–4.0s): "על סידורי הושבה." completes the headline; heart-red underline draws right→left under "סידורי הושבה". Hold.

@@5
- blueprint: titlecard-reveal (Reproduce — CTA card)
- focal: assets/user/box-closed.jpg
- roles: box-closed = background (full-bleed, object-position center 70%, white gradient on the top ~52%)
- sfx: none
- cues: "Before I Do" 0.05 · "מגיע ארוז" 1.1 · "ומוכן למסירה" 1.8 · end 3.5
- captions: none on this frame (the on-screen copy is the narration)

The held end card.
Scene 1 (0.0–1.0s): box photo full-bleed under a barely perceptible continuous scale-up (1.00→1.04); the Caveat "Before I Do" wordmark (blue ~162px, centered, y≈150–330) writes on left→right; red heart pops once.
Scene 2 (1.1–2.2s): heart-red tag-pill "מגיע ארוז ומוכן למסירה" (white 600 ~60px) swings in like a hanging gift tag (small rotation settling to 0, smooth) on "מגיע ארוז".
Scene 3 (2.2–2.9s): the wink line "אחד לזוג. אלא אם אתם מכירים / עוד זוג שמתחתן." (ink-deep 600 ~50px) fades up; URL pill "beforeido.co.il" (solid blue, white 600 ~60px, LTR, y≈1210) fades up.
Scene 4 (2.9–3.5s): hold perfectly still to the last frame. No exit.
