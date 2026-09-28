/* ==================================================================
   חתונה בלי פילטרים — Instagram Reel outro (1080×1920, 30 fps, 4 s)

   Everything on screen is a pure function of time: OUTRO.renderAt(t)
   sets every animated attribute from scratch, uses no wall clock and no
   unseeded randomness, so any frame can be rendered in any order and
   every render is identical. tools/render.mjs captures frames through it.
   ================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------
     CONFIG — the knobs. Colours live in styles.css (:root variables).
     ---------------------------------------------------------------- */
  const CONFIG = {
    palette: 'logo',       // 'logo' = colours sampled from the supplied logo, 'brief' = written brief palette
    fps: 30,
    duration: 4.0,         // seconds. All timings below are authored for 4.0 s and scale with this.

    logo: {
      scale: 0.84,         // logo px → stage px (lockup is 1000 source px wide → 840 px)
      centerX: 540,        // stage x of the lockup centre
      centerY: 850,        // stage y of the lockup centre (IG safe area 220–1500 → centre ≈ 860)
    },

    glass:  { x: 540, baseY: 1330, scale: 1.2 },
    groom:  { scale: 1.25 },

    // Authored timeline (seconds, at duration = 4.0).
    timeline: {
      length:          4.0,
      glassDraw:      [0.06, 0.42],
      legEnter:       [0.10, 0.50],
      windUp:         [0.50, 0.64],
      impact:          0.72,          // glass impact. Stomp, burst and shoe exit follow it.
      stompLength:     0.08,
      burstLength:     0.30,          // fragments fly out and come to rest
      shoeExit:       [0.86, 1.12],
      assemble:       [1.15, 1.86],   // fragments travel and build חתונה
      wordComplete:    1.90,
      labelStart:      2.14,          // off-frame; crosses the frame edge ≈ 2.20
      labelImpact:     2.42,
      labelSettle:     2.56,
      names:          [2.60, 2.92],
      rules:          [2.64, 3.04],
    },

    // Intro version (?version=intro / render --version intro): 8 s, synced to
    // tools/make_soundtrack.py — "Here Comes the Bride" on organ while the glass
    // draws in, the shoe smashes it on "white" and the beat drops.
    introTimeline: {
      length:          8.0,
      glassDraw:      [0.25, 2.20],
      legEnter:       [2.86, 3.72],
      windUp:         [3.72, 4.08],
      impact:          4.16,          // = beat drop
      stompLength:     0.08,
      burstLength:     0.30,
      shoeExit:       [4.30, 4.56],
      assemble:       [4.59, 5.30],
      wordComplete:    5.34,
      labelStart:      5.80,
      labelImpact:     6.08,          // on beat 4 of the first bar
      labelSettle:     6.22,
      names:          [6.26, 6.58],
      rules:          [6.30, 6.70],
    },

    fragments: { count: 16, seed: 20260928 },

    // Audio sync markers (seconds, at duration = 4.0) — also used by tools/render.mjs --sfx
    audioMarkers: {
      glassImpact:    0.72,
      fragmentsMove:  1.15,
      wordComplete:   1.90,
      stickerEnter:   2.20,
      stickerImpact:  2.42,
      namesReveal:    2.75,
    },
  };

  const GEO = window.OUTRO_GEOMETRY;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);

  /* ----------------------------------------------------------------
     Easing: exact cubic-bezier, same maths as CSS timing functions.
     ---------------------------------------------------------------- */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t;
    const Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = X(t) - x;
        if (Math.abs(e) < 1e-7) return Y(t);
        const d = dX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 40; i++) {
        const v = X(t);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return Y(t);
    };
  }

  const EASE = {
    enter:     bezier(0.16, 0.84, 0.30, 1.00),  // decelerating arrival
    inOut:     bezier(0.45, 0.00, 0.40, 1.00),
    windUp:    bezier(0.40, 0.00, 0.30, 1.00),
    stomp:     bezier(0.60, 0.00, 0.90, 0.40),  // accelerates into the impact
    exit:      bezier(0.55, 0.00, 0.85, 0.35),
    burst:     bezier(0.10, 0.85, 0.25, 1.00),  // violent start, soft stop
    travel:    bezier(0.55, 0.00, 0.15, 1.00),
    grow:      bezier(0.75, 0.00, 0.25, 1.00),
    sticker:   bezier(0.14, 0.86, 0.32, 1.00),
    settle:    bezier(0.30, 0.00, 0.20, 1.00),
    reveal:    bezier(0.20, 0.70, 0.20, 1.00),
    line:      bezier(0.30, 0.60, 0.10, 1.00),
    linear:    (x) => x,
  };

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, t0, t1) => (t1 <= t0 ? (t >= t1 ? 1 : 0) : clamp01((t - t0) / (t1 - t0)));
  const f = (v) => (Math.round(v * 1000) / 1000); // stable attribute strings

  // Seeded PRNG (mulberry32) — deterministic layout for fragments.
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ----------------------------------------------------------------
     Geometry helpers
     ---------------------------------------------------------------- */
  const L = CONFIG.logo;
  const LOCK = GEO.lockupBox;
  const lockCX = LOCK.x + LOCK.width / 2;
  const lockCY = LOCK.y + LOCK.height / 2;
  const logoToStage = (x, y) => [L.centerX + (x - lockCX) * L.scale, L.centerY + (y - lockCY) * L.scale];
  const logoTransform = `translate(${f(L.centerX)} ${f(L.centerY)}) scale(${L.scale}) translate(${f(-lockCX)} ${f(-lockCY)})`;

  const QUAD = GEO.labelQuad;
  const labelCenter = QUAD.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);

  const glassX = CONFIG.glass.x;
  const groundY = CONFIG.glass.baseY;
  const GS = CONFIG.groom.scale;
  const FOREFOOT_X = -118;                      // local x of the ball of the foot (shoe art)
  const groomX = glassX - FOREFOOT_X * GS;      // puts the ball of the foot over the glass
  const toeX = groomX - 192 * GS;
  const heelX = groomX + 146 * GS;

  /* ----------------------------------------------------------------
     Build dynamic layers
     ---------------------------------------------------------------- */
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // Label
  const quadPts = QUAD.map((p) => p.join(',')).join(' ');
  $('label-fill').setAttribute('points', quadPts);
  $('label-knockout').setAttribute('points', quadPts);
  $('label-knockout').setAttribute('stroke-width', GEO.knockout * 2);

  // Rules
  const [ruleL, ruleR] = GEO.rules;
  for (const [id, r] of [['rule-left', ruleL], ['rule-right', ruleR]]) {
    const n = $(id);
    n.setAttribute('y1', r.y); n.setAttribute('y2', r.y);
    n.setAttribute('stroke-width', r.thickness);
  }

  $('logo').setAttribute('transform', logoTransform);

  // Impact strokes: two fans, one off the toe and one off the heel.
  const IMPACT = [];
  const impactLayer = $('layer-impact');
  const fans = [
    { ox: toeX - 6, angles: [-172, -154, -136] },
    { ox: heelX + 6, angles: [-44, -26, -8] },
  ];
  for (const fan of fans) {
    fan.angles.forEach((a, i) => {
      IMPACT.push({
        node: el('line', { class: 'impact-line' }, impactLayer),
        ox: fan.ox, oy: groundY - 10,
        a: (a * Math.PI) / 180,
        len: [54, 72, 60][i],
      });
    });
  }

  // Fragments: a jittered 4×2 grid over חתונה split into 16 triangles.
  // Each triangle is both a glass shard (solid) and, on arrival, the exact
  // piece of the logo artwork it covers (clip of #word-art).
  const rand = prng(CONFIG.fragments.seed);
  const WB = { x0: 20, y0: 14, x1: 1012, y1: 456 };      // חתונה bounds (crop px) + margin
  const COLS = 4, ROWS = 2;
  const V = [];
  for (let r = 0; r <= ROWS; r++) {
    V.push([]);
    for (let c = 0; c <= COLS; c++) {
      let x = lerp(WB.x0, WB.x1, c / COLS);
      let y = lerp(WB.y0, WB.y1, r / ROWS);
      const edgeX = c === 0 || c === COLS, edgeY = r === 0 || r === ROWS;
      if (!edgeX) x += (rand() * 2 - 1) * 55;
      if (!edgeY) y += (rand() * 2 - 1) * 45;
      V[r].push([x, y]);
    }
  }
  const tris = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = V[r][c], b = V[r][c + 1], d = V[r + 1][c], e = V[r + 1][c + 1];
      if ((r + c) % 2 === 0) { tris.push([a, b, e], [a, e, d]); } else { tris.push([a, b, d], [b, e, d]); }
    }
  }

  const defs = document.querySelector('#stage defs');
  const fragLayer = $('layer-fragments');
  const origin = [glassX, groundY - 40];
  const cells = tris.map((tri) => ({
    tri,
    c: [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3],
  }));
  cells.sort((p, q) => p.c[0] - q.c[0]);   // left cells scatter left, right cells right

  const N = cells.length;
  const FRAGS = cells.map((cell, i) => {
    const { tri, c } = cell;
    const pts = tri.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
    // Clip slightly larger than the cell so neighbours overlap (no hairline seams).
    const grow = tri.map((p) => [c[0] + (p[0] - c[0]) * 1.012, c[1] + (p[1] - c[1]) * 1.012]);
    const clip = el('clipPath', { id: `frag-clip-${i}`, clipPathUnits: 'userSpaceOnUse' }, defs);
    el('polygon', { points: grow.map((p) => `${f(p[0])},${f(p[1])}`).join(' ') }, clip);

    const g = el('g', { class: 'frag' }, fragLayer);
    const piece = el('g', { 'clip-path': `url(#frag-clip-${i})` }, g);
    el('use', { href: '#word-art' }, piece);
    const solid = el('polygon', { class: 'shard-solid', points: pts }, g);
    const edge = el('polygon', { class: 'shard-edge', points: pts }, g);

    // Scatter position: fan out above the ground, ordered left → right.
    const ang = (-176 + ((i + 0.5) / N) * 172 + (rand() * 2 - 1) * 5) * Math.PI / 180;
    const rad = 250 + rand() * 250;
    let sx = origin[0] + Math.cos(ang) * rad * 1.05;
    let sy = origin[1] + Math.sin(ang) * rad * 0.9;
    sx = Math.min(1010, Math.max(70, sx));
    sy = Math.min(groundY - 50, sy);

    const target = logoToStage(c[0], c[1]);
    const dx = target[0] - sx, dy = target[1] - sy;
    const len = Math.hypot(dx, dy) || 1;
    const bend = (i % 2 ? 1 : -1) * (70 + rand() * 120);
    const rotRest = (rand() < 0.5 ? -1 : 1) * (110 + rand() * 170);

    return {
      g, piece, solid, edge, c,
      start: [origin[0] + (rand() * 2 - 1) * 30, origin[1] + rand() * 20],
      scatter: [sx, sy],
      ctrl: [(sx + target[0]) / 2 - (dy / len) * bend, (sy + target[1]) / 2 + (dx / len) * bend],
      target,
      s0: 0.12 + rand() * 0.07,
      rot0: rotRest - (rand() < 0.5 ? -1 : 1) * (160 + rand() * 160),
      rotRest,
      delay: rand() * 0.12,
    };
  });

  /* ----------------------------------------------------------------
     renderAt(t) — the whole animation
     ---------------------------------------------------------------- */
  const glassPaths = Array.from(document.querySelectorAll('#layer-glass .glass-line'));
  const setVis = (node, on) => node.setAttribute('display', on ? 'inline' : 'none');

  function renderAt(tIn) {
    const T = CONFIG.timeline;
    const t = clamp01(tIn / CONFIG.duration) * T.length;   // authored time
    const imp = T.impact;
    const stompStart = imp - T.stompLength;
    const burstEnd = imp + T.burstLength;

    /* -- camera: tiny scale punch on impact -------------------------- */
    let punch = 0;
    if (t >= imp) punch = 1 - EASE.enter(seg(t, imp, imp + 0.18));
    const cs = 1 + 0.035 * punch;
    $('camera').setAttribute('transform',
      `translate(${glassX} ${groundY}) scale(${f(cs)}) translate(${-glassX} ${-groundY})`);

    /* -- glass ------------------------------------------------------- */
    const glassOn = t >= T.glassDraw[0] && t < imp;
    setVis($('layer-glass'), glassOn);
    $('layer-glass').setAttribute('transform',
      `translate(${glassX} ${groundY}) scale(${CONFIG.glass.scale})`);
    glassPaths.forEach((p, i) => {
      const k = glassPaths.length;
      const dur = Math.max(0.2, (T.glassDraw[1] - T.glassDraw[0]) * 0.4);
      const t0 = lerp(T.glassDraw[0], T.glassDraw[1] - dur, i / (k - 1));
      const d = EASE.inOut(seg(t, t0, t0 + dur));
      p.setAttribute('stroke-dasharray', '1 1');
      p.setAttribute('stroke-dashoffset', f(1 - d));
    });

    /* -- groom: descend, wind up, stomp, grind, leave ---------------- */
    const hoverY = groundY - 360, windY = groundY - 392, offTop = -40, exitY = -80;
    let gy = offTop, grot = 0, gsy = 1;
    if (t < T.legEnter[0]) gy = offTop;
    else if (t < T.windUp[0]) gy = lerp(offTop, hoverY, EASE.enter(seg(t, T.legEnter[0], T.legEnter[1])));
    else if (t < stompStart) gy = lerp(hoverY, windY, EASE.windUp(seg(t, T.windUp[0], T.windUp[1])));
    else if (t < imp) gy = lerp(windY, groundY, EASE.stomp(seg(t, stompStart, imp)));
    else if (t < T.shoeExit[0]) {
      gy = groundY;
      const k = seg(t, imp, T.shoeExit[0]);
      gsy = 1 - 0.03 * Math.sin(Math.PI * Math.min(1, k * 2.2)); // press
      grot = -1.4 * Math.sin(Math.PI * k);                        // small grind
    } else gy = lerp(groundY, exitY, EASE.exit(seg(t, T.shoeExit[0], T.shoeExit[1])));
    const groomOn = t >= T.legEnter[0] && t < T.shoeExit[1];
    setVis($('layer-groom'), groomOn);
    $('layer-groom').setAttribute('transform',
      `translate(${f(groomX)} ${f(gy)}) rotate(${f(grot)}) scale(${GS} ${f(GS * gsy)})`);

    /* -- impact strokes ---------------------------------------------- */
    const ip = seg(t, imp, imp + 0.22);
    const impactOn = t >= imp && ip < 1;
    setVis($('layer-impact'), impactOn);
    if (impactOn) {
      const out = EASE.burst(clamp01(ip * 1.7));
      const tail = EASE.inOut(clamp01((ip - 0.25) / 0.75));
      for (const s of IMPACT) {
        const r0 = 14 + (s.len + 30) * tail, r1 = 14 + (s.len + 30) * out;
        s.node.setAttribute('x1', f(s.ox + Math.cos(s.a) * r0));
        s.node.setAttribute('y1', f(s.oy + Math.sin(s.a) * r0));
        s.node.setAttribute('x2', f(s.ox + Math.cos(s.a) * r1));
        s.node.setAttribute('y2', f(s.oy + Math.sin(s.a) * r1));
      }
    }

    /* -- fragments ---------------------------------------------------- */
    const [aStart, aEnd] = T.assemble;
    const fragOn = t >= imp && t < aEnd;
    setVis(fragLayer, fragOn);
    if (fragOn) {
      for (const fr of FRAGS) {
        let x, y, rot, sc, solidA = 1, pieceA = 0, edgeA = 0;
        if (t < burstEnd) {
          const k = EASE.burst(seg(t, imp, burstEnd));
          x = lerp(fr.start[0], fr.scatter[0], k);
          y = lerp(fr.start[1], fr.scatter[1], k) - Math.sin(Math.PI * k) * 26; // slight toss
          rot = lerp(fr.rot0, fr.rotRest, k);
          sc = fr.s0 * lerp(0.55, 1, clamp01(k * 3));
        } else if (t < aStart + fr.delay) {
          x = fr.scatter[0]; y = fr.scatter[1]; rot = fr.rotRest; sc = fr.s0;    // the pause
        } else {
          const p = seg(t, aStart + fr.delay, aEnd);
          const k = EASE.travel(p), u = 1 - k;
          x = u * u * fr.scatter[0] + 2 * u * k * fr.ctrl[0] + k * k * fr.target[0];
          y = u * u * fr.scatter[1] + 2 * u * k * fr.ctrl[1] + k * k * fr.target[1];
          rot = fr.rotRest * (1 - k);
          sc = lerp(fr.s0, 1, EASE.grow(p));
          solidA = 1 - EASE.inOut(seg(p, 0.34, 0.66));
          pieceA = EASE.inOut(seg(p, 0.28, 0.58));
          edgeA = seg(p, 0.30, 0.46) * (1 - EASE.inOut(seg(p, 0.72, 0.97)));
        }
        const s = sc * L.scale;
        fr.g.setAttribute('transform',
          `translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)}) translate(${f(-fr.c[0])} ${f(-fr.c[1])})`);
        fr.solid.setAttribute('opacity', f(solidA));
        fr.piece.setAttribute('opacity', f(pieceA));
        fr.edge.setAttribute('opacity', f(edgeA * 0.7));
      }
    }

    /* -- חתונה --------------------------------------------------------- */
    setVis($('layer-word'), t >= aEnd);
    let nudge = 0;
    if (t >= T.labelImpact) nudge = 3 * (1 - EASE.settle(seg(t, T.labelImpact, T.labelSettle)));
    $('layer-word').setAttribute('transform', `translate(0 ${f(nudge / L.scale)})`);

    /* -- בלי פילטרים label -------------------------------------------- */
    const labelOn = t >= T.labelStart;
    setVis($('layer-label'), labelOn);
    if (labelOn) {
      const from = [-900 / L.scale, 760 / L.scale];            // lower-left, off frame
      const dirLen = Math.hypot(from[0], from[1]);
      const over = [(-from[0] / dirLen) * 14 / L.scale, (-from[1] / dirLen) * 14 / L.scale];
      let dx, dy, rot, sc;
      if (t < T.labelImpact) {
        const p = seg(t, T.labelStart, T.labelImpact);
        const k = EASE.sticker(p);
        dx = lerp(from[0], over[0], k); dy = lerp(from[1], over[1], k);
        rot = lerp(-11, 1.3, k);
        sc = lerp(1.1, 1, EASE.inOut(p));
      } else {
        const q = seg(t, T.labelImpact, T.labelSettle);
        const k = EASE.settle(q);
        dx = over[0] * (1 - k); dy = over[1] * (1 - k);
        rot = 1.3 * (1 - k) - 0.55 * Math.sin(Math.PI * k);      // tiny counter-rotation
        sc = 1 - 0.012 * Math.sin(Math.PI * Math.min(1, q * 1.6)); // pressed flat
      }
      const [cx, cy] = labelCenter;
      $('layer-label').setAttribute('transform',
        `translate(${f(dx)} ${f(dy)}) translate(${f(cx)} ${f(cy)}) rotate(${f(rot)}) scale(${f(sc)}) translate(${f(-cx)} ${f(-cy)})`);
    }

    /* -- names + rules ------------------------------------------------ */
    const namesOn = t >= T.names[0];
    setVis($('layer-names'), namesOn);
    if (namesOn) {
      const k = EASE.reveal(seg(t, T.names[0], T.names[1]));
      const nt = $('names-text');
      nt.setAttribute('opacity', f(k));
      nt.setAttribute('transform', `translate(0 ${f(((1 - k) * 10) / L.scale)})`);
      const r = EASE.line(seg(t, T.rules[0], T.rules[1]));
      // Rules grow outward from the names: left one leftward, right one rightward.
      $('rule-left').setAttribute('x2', ruleL.x2);
      $('rule-left').setAttribute('x1', f(ruleL.x2 - (ruleL.x2 - ruleL.x1) * r));
      $('rule-right').setAttribute('x1', ruleR.x1);
      $('rule-right').setAttribute('x2', f(ruleR.x1 + (ruleR.x2 - ruleR.x1) * r));
      setVis($('rule-left'), r > 0);
      setVis($('rule-right'), r > 0);
    }

    $('logo').setAttribute('opacity', 1);
  }

  /* ----------------------------------------------------------------
     Instagram UI guides (preview aid)
     ---------------------------------------------------------------- */
  function drawGuides() {
    const g = $('guides');
    const zones = [
      { x: 0, y: 0, w: 1080, h: 220, t: 'top UI' },
      { x: 0, y: 1500, w: 1080, h: 420, t: 'caption / buttons' },
      { x: 930, y: 1040, w: 150, h: 460, t: '' },
    ];
    for (const z of zones) {
      el('rect', { class: 'guide-zone', x: z.x, y: z.y, width: z.w, height: z.h }, g);
      if (z.t) {
        const tx = el('text', { class: 'guide-label', x: z.x + 24, y: z.y + (z.y ? 44 : z.h - 24) }, g);
        tx.textContent = z.t;
      }
    }
  }

  /* ----------------------------------------------------------------
     Boot: wait for the logo masks, then preview or hand over to render
     ---------------------------------------------------------------- */
  const params = new URLSearchParams(location.search);
  const palette = params.get('palette') || CONFIG.palette;
  if (palette === 'brief') document.documentElement.setAttribute('data-palette', 'brief');
  if (params.get('version') === 'intro') {
    CONFIG.timeline = CONFIG.introTimeline;
    CONFIG.duration = CONFIG.introTimeline.length;
    const T = CONFIG.timeline;
    CONFIG.audioMarkers = { beatDrop: T.impact, stickerImpact: T.labelImpact, end: T.length };
  }
  if (params.has('duration')) CONFIG.duration = parseFloat(params.get('duration')) || CONFIG.duration;

  const imageUrls = Array.from(document.querySelectorAll('#stage image')).map((n) => n.getAttribute('href'));
  const ready = Promise.all(imageUrls.map((u) => {
    const img = new Image();
    img.src = u;
    return img.decode().catch(() => {});
  })).then(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

  const totalFrames = Math.round(CONFIG.duration * CONFIG.fps);
  window.OUTRO = {
    CONFIG,
    renderAt,
    renderFrame: (i) => renderAt(i / CONFIG.fps),
    get totalFrames() { return Math.round(CONFIG.duration * CONFIG.fps); },
    markers: () => Object.fromEntries(Object.entries(CONFIG.audioMarkers)
      .map(([k, v]) => [k, +(v * CONFIG.duration / CONFIG.timeline.length).toFixed(3)])),
    ready,
  };

  renderAt(0);

  if (params.has('render')) {
    document.documentElement.classList.add('render');
    return; // the capture script drives renderAt()
  }

  // ---- interactive preview ----
  drawGuides();
  const frame = $('stageFrame');
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight - 56;
    const s = Math.min((vw - 16) / 1080, (vh - 16) / 1920);
    frame.style.transform = `scale(${s})`;
    frame.style.margin = `${(1920 * s - 1920) / 2}px ${(1080 * s - 1080) / 2}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  const scrub = $('scrub'), readout = $('readout'), btnPlay = $('btnPlay');
  const chkLoop = $('chkLoop'), chkGuides = $('chkGuides');
  scrub.max = String(totalFrames - 1);
  if (params.has('guides')) chkGuides.checked = true;
  const syncGuides = () => setVis($('guides'), chkGuides.checked);
  chkGuides.addEventListener('change', syncGuides);
  syncGuides();

  const LOOP_GAP = 0.45;       // preview only: soft fade back to paper before looping
  let playing = !params.has('t');
  let t0 = performance.now();
  let pos = params.has('t') ? parseFloat(params.get('t')) : 0;

  function show(time) {
    const D = CONFIG.duration;
    if (time <= D) {
      renderAt(Math.min(time, D));
    } else {
      renderAt(D);
      $('logo').setAttribute('opacity', f(1 - EASE.inOut(seg(time, D + 0.15, D + LOOP_GAP))));
    }
    const fr = Math.min(totalFrames - 1, Math.floor(Math.min(time, D) * CONFIG.fps + 1e-6));
    scrub.value = String(fr);
    readout.textContent = `${Math.min(time, D).toFixed(3)}s · f${fr}`;
  }

  function tick(now) {
    if (playing) {
      const D = CONFIG.duration;
      const span = chkLoop.checked ? D + LOOP_GAP : D + 10;
      pos = ((now - t0) / 1000);
      if (chkLoop.checked) pos %= span;
      else if (pos >= D) { pos = D; playing = false; btnPlay.textContent = 'Play'; }
      show(pos);
    }
    requestAnimationFrame(tick);
  }
  btnPlay.textContent = playing ? 'Pause' : 'Play';
  btnPlay.addEventListener('click', () => {
    playing = !playing;
    if (playing) { if (pos >= CONFIG.duration) pos = 0; t0 = performance.now() - pos * 1000; }
    btnPlay.textContent = playing ? 'Pause' : 'Play';
  });
  $('btnStep').addEventListener('click', () => {
    playing = false; btnPlay.textContent = 'Play';
    pos = Math.min(CONFIG.duration, (Math.round(pos * CONFIG.fps) + 1) / CONFIG.fps);
    show(pos);
  });
  scrub.addEventListener('input', () => {
    playing = false; btnPlay.textContent = 'Play';
    pos = parseInt(scrub.value, 10) / CONFIG.fps;
    show(pos);
  });
  ready.then(() => { t0 = performance.now() - pos * 1000; show(pos); requestAnimationFrame(tick); });
})();
