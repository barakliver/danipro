@@VIDEO_DIRECTION
## Video direction

- **Palette (frame.md roles):** canvas white `bg`; brand blue `primary` #4F6BA5 for pills/labels/stat; `ink-deep` #1F2C4A for headlines on light and for the footage-dimming gradients (never pure black); `tint` #DDE7F5 for pill fills / secondary headline color on dark; `heart` #EF453D is the ONE accent — underlines, the heart mark, the "03" pill; nothing else is red.
- **Type:** Assistant 700 headlines, Assistant 600 pills/labels; Caveat 600 ONLY for the "Before I Do" wordmark (LTR, red heart after "Do"). Hebrew text is RTL (`dir="rtl"`), right-aligned unless the sketch centers it.
- **Canvas & safe zones (1080×1920 Reels):** key content between y≈190 and y≈1180. Caption band y≈1190–1345 stays clear on frames 1–4 (frame 5 has no captions and may use it). Below y≈1345 only footage/photo. From y≈1020 down, keep text out of the right ~120px (Instagram action buttons).
- **Motion grammar:** smooth long-tail settles (`power3` / `expo.out` on fast arrivals); overshoot only on the small heart pop. Every reveal lands on its spoken cue; first visible motion within 0.1s of each frame start (scroll-stopping). Something new arrives every ~0.8–1.2s through frames 1–4 (retention rhythm), then frame 5 slows to a held read.
- **Direction rule:** horizontal motion travels right → left (Hebrew reading direction); underlines draw right → left.
- **Footage:** real user clips (muted, H.264) full-bleed `cover`; dim with a deep-ink gradient where text sits (top), never a flat grey veil. A slow constant push on footage only (never on text) is allowed.
- **Rhythm / stillness:** frames 1–4 reveal to the VO; frame 5 is the deliberate held frame (one restrained move, then stillness). Holds may carry subtle jitter at most.
- **Timing hooks:** durations are estimates until the user's recorded VO arrives; every frame keeps its cue times in one `CUES` object at the top of its script so re-timing is a numbers-only edit.
- **Negative list:** no glow/bloom halos, no heavy drop shadows, no emoji glyphs (inline SVG only), no fake product UI, no lazy breathing, no back-half text pans, no bounce/elastic eases, no slideshow (front-load then freeze), no screensaver (independent floating), no CSS transitions/keyframes, no repeat/yoyo, no randomness.

@@1
- blueprint: kinetic-type-beats (Adapt)
- focal: assets/user/clip-7319-box-table.mp4
- roles: clip-7319-box-table = background (full-bleed, deep-ink gradient ~80% at top fading to ~35% at bottom), playback-rate 0.65 so 2.87s covers the frame
- sfx: none
- cues: "רוב" 0.1 · "לא רבים" 0.9 · "על החתונה" 1.4 · "הם פשוט" 2.2 · "אף פעם" 3.0 · "דיברו" 3.6 · end 4.5

Adapt: sub-shape B escalation, but the two statements STACK at the sketch's anchors instead of replacing each other (approved sketch); keep the signature — each beat lands with its own move and the payoff word gets an accent-color drawn underline.
Scene 1 (0.0–0.9s): footage already moving full-bleed; "רוב הזוגות" rises word-by-word out of a line mask (per-word staggered reveal → `dynamic-content-sequencing`) at the sketch's upper-right anchor (y≈240), white Assistant 700 ~113px. Constant slow push on the footage only (1.00→1.06 over the frame).
Scene 2 (0.9–2.1s): "לא רבים" then "על החתונה." continue the per-word reveal on their cues, same block, three lines total — the first statement complete.
Scene 3 (2.2–3.5s): second statement begins below (y≈560) in `tint`: "הם פשוט אף פעם" per-word; on "פשוט..." a deliberate half-beat of stillness (the pause is the tension).
Scene 4 (3.5–4.5s): "לא דיברו עליה." lands; as "דיברו" is spoken a heart-red underline draws right→left beneath it (`css-marker-patterns`, highlight/underline sweep), the word itself flips to white. Hold — subtle jitter only (`sine-wave-loop`, low amplitude).

@@2
- blueprint: kinetic-type-beats (Adapt)
- focal: none (typography frame)
- roles: none
- sfx: none
- cues: "כמה אורחים" 0.05 · answers 0.55 · "מי מהעבודה" 1.0 · answers 1.45 · "איפה ההורים" 1.9 · "ופתאום" 3.3 · "כל החלטה" 3.9 · "משא ומתן" 4.6 · end 5.5

Adapt: Problem relay — the questions pop in one by one and ACCUMULATE at the sketch's staggered anchors (not replace); keep the signature climax word with its accent move. "Their words" layer (new, user ask): under the first two questions, two tiny answer chips pop from opposite sides like two partners answering at once — they show the couple disagreeing without saying it (source: the site's "אתם עונים שני מספרים שונים").
Scene 1 (0.0–1.0s): white field; pill "כמה אורחים?" (tint fill, blue 600 ~71px) pops in at y≈200 right-aligned (`spring-pop-entrance`, smooth settle); at ~0.55s two small chips flank it from left and right — "150" (blue outline) and "300" (heart-red outline) — each sliding in from its own side and settling.
Scene 2 (1.0–1.9s): pill "מי מהעבודה?" pops in at the sketch's indented anchor (y≈330); chips "כולם" and "אף אחד" flank it the same way, a touch faster.
Scene 3 (1.9–3.3s): pill "איפה ההורים נכנסים?" pops in at y≈460; no chips — instead all three pills and their chips start a small nervous jitter that grows (tension), finite.
Scene 4 (3.3–3.9s): on "ופתאום" the whole question cluster jolts once and tilts a few degrees askew while dimming to ~45% (it stays readable as the sketch's landed state — pushed into the background, not removed); "ופתאום," appears in ink-deep at y≈720.
Scene 5 (3.9–5.5s): "כל החלטה היא" then "משא ומתן." reveal per word (`dynamic-content-sequencing`), Assistant 700 ~104px ink-deep; on "משא ומתן" a heart-red underline draws right→left (`css-marker-patterns`). Hold still.

@@3
- blueprint: video-text-pivot (Adapt)
- focal: assets/user/clip-7317-open-box-top.mp4
- roles: clip-7317-open-box-top = background (full-bleed, data-media-start 1.0 so the lid lifts inside the frame; deep-ink gradient on the top ~40%)
- sfx: none
- cues: "Before I Do" 0.05 · "משחק קלפים" 1.0 · "שבעים" 2.7 · "שחובה לשאול" 3.6 · end 5.0

Adapt: keep the signature weight-transfer (the video YIELDS space to the hero stat in one event); change: the video stays full-bleed and yields by receding into a rounded card rather than sliding sideways, because the approved sketch keeps the footage full-frame.
Scene 1 (0.0–1.0s): footage playing full-bleed (the hand lifts the lid); the "Before I Do" Caveat wordmark (white, ~173px, LTR, centered at y≈130–300) writes itself on left→right via a soft-edged mask wipe (handwriting feel; `svg-path-draw` intent realized as a mask wipe on the text); the red heart pops in after "Do" with a small playful overshoot (the one sanctioned overshoot).
Scene 2 (1.0–2.6s): subline "משחק קלפים לזוגות מאורסים" (white 600 ~58px, centered under the wordmark) reveals per word.
Scene 3 (2.7–3.6s): YIELD — the footage recedes (scale 1.00→0.94, corners round to ~28px, a hairline `border` appears) while a white stat card rises from below into the sketch's position (x 86–994, y≈864–1060): "70" (blue 700 ~184px) counts up 0→70 as "שבעים" is spoken (`counting-dynamic-scale`).
Scene 4 (3.6–5.0s): the card's label "שאלות שחובה לשאול / לפני החתונה" (ink-deep 600 ~58px) reveals line by line beside the number. Hold.

@@4
- blueprint: compose
- focal: assets/user/clip-7298-hand-card.mp4
- roles: clip-7318-pull-card = background (first half, full-bleed, data-media-start 2.6, plays 0.0–1.95s) · clip-7298-hand-card = background (second half, full-bleed, playback-rate 0.6, 1.95–5.5s) · both with a deep-ink gradient on the top ~45%
- sfx: none
- cues: "פותחים בקבוק" 0.05 · "שולפים קלף" 1.0 · "ומדברים" 1.9 · "על מה חשוב לכם" 2.7 · "לא מוותרים" 3.9 · end 5.5

Compose. The sketch's left inset was a storyboard device marking the first-half clip — in the build the two clips play full-bleed one after the other. "Their words" layer (new, user ask): the real dilemmas printed on the cards cycle in a slot, so viewers see the actual questions inside the box.
Scene 1 (0.0–1.0s): clip 7318 full-bleed (hand reaching into the open box); pill "01 · פותחים בקבוק" (white fill, blue 600 ~65px) slides in from the right edge to the sketch anchor (y≈180) and settles.
Scene 2 (1.0–1.9s): pill "02 · שולפים קלף" slides in below (y≈290) as the card comes out of the box.
Scene 3 (1.9–2.7s): cut-the-curve (`cut-catalog.md`) to clip 7298 (hand holding the card up) — the cut lands mid-motion; pill "03 · מדברים" (heart-red fill, white text) pops in at y≈400.
Scene 4 (2.7–5.5s): a white dilemma pill appears under the steps (y≈540, right-aligned, max width ~860px): its text cycles in place by hard cut (`discrete-text-sequence`, in-place token cycle) through the box's real cards — "דיג'יי או להקה חיה" (2.7s) → "הגשה לשולחן או בופה" (3.5s) → "להביא את הכלב או להשאיר אותו בבית" (4.3s, holds) — the word "או" always heart-red 700. Hold.

@@5
- blueprint: titlecard-reveal (Reproduce — CTA card)
- focal: assets/user/box-closed.jpg
- roles: box-closed = background (full-bleed, object-position center 70%, white gradient on the top ~50% for the headline)
- sfx: none
- cues: "שיחה אחת" 0.05 · "לפני כל השאר" 1.0 · "Before I Do" 2.4 · end 4.0
- captions: none on this frame (the on-screen line is the narration)

The deliberate held frame — one restrained move per element, then stillness.
Scene 1 (0.0–1.0s): box photo full-bleed under a barely perceptible continuous scale-up (1.00→1.04 over the whole frame — the only camera motion); "שיחה אחת," (ink-deep 700 ~119px, centered, y≈170) fades up with a small rise and settles.
Scene 2 (1.0–2.3s): "לפני כל השאר." follows on its cue the same way.
Scene 3 (2.4–3.4s): the white rounded lockup card (x 151–929, y≈1123–1400) rises into place; inside it the Caveat "Before I Do" wordmark (blue ~140px) writes on left→right and the red heart beats once (one scale pulse, no loop); the URL pill "beforeido.co.il" (solid blue, white 600 ~60px, LTR) fades up beneath.
Scene 4 (3.4–4.0s): everything holds perfectly still to the last frame (clean loop point for Reels). No exit.
