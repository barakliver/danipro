// Deterministic graphic renderer.
//
// Every Story frame and carousel slide is a standalone HTML document at exact
// pixel size (1080×1920 or 1080×1350). The editor shows it in a scaled iframe;
// export renders the same document in headless Chromium (or html-to-image in
// the browser as a fallback). One source of truth means the preview matches the export.
//
// Hebrew is shaped by the browser engine (HarfBuzz) with native bidi, never by an
// image model. This module is pure: no DOM, no Node APIs, safe on server and client.

import type { StoryElementKind } from "@/lib/domain/content-body";
import { CAROUSEL_SIZE, STORY_SIZE, type DesignSettings } from "./design-settings";
import type { TemplateFamily } from "./families";

export type RenderFormat = "story" | "carousel";

export type RenderFrame = {
  kind: StoryElementKind | "slide";
  text: string;
  subtext?: string;
  options?: string[];
  emoji?: string;
  /** carousel position */
  index?: number;
  total?: number;
  role?: "cover" | "body" | "final";
};

export type RenderInput = {
  format: RenderFormat;
  family: TemplateFamily;
  frame: RenderFrame;
  settings: DesignSettings;
  /** signed URL or data URI of a Gallery photo */
  imageUrl?: string | null;
  /** template config overrides (text position, labels, background) */
  config?: Record<string, unknown>;
  /** CSS that declares the fonts (url-based in the browser, inlined on the server) */
  fontCss: string;
  /** preview-only guides (safe areas, sticker placeholders). Never in exports. */
  guides?: boolean;
};

export function canvasSize(format: RenderFormat) {
  return format === "story" ? STORY_SIZE : CAROUSEL_SIZE;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Text size step from copy length. Deterministic, so a frame never reflows between preview and export. */
export function sizeStep(text: string): "xl" | "lg" | "md" | "sm" {
  const length = Array.from(text.trim()).length;
  const lines = text.split("\n").length;
  const weight = length + (lines - 1) * 14;
  if (weight <= 46) return "xl";
  if (weight <= 95) return "lg";
  if (weight <= 170) return "md";
  return "sm";
}

const IMAGE_FILTER: Record<DesignSettings["imageTreatment"], string> = {
  natural: "none",
  warm: "sepia(0.14) saturate(1.06) brightness(1.02)",
  soft: "contrast(0.93) brightness(1.04) saturate(0.95)",
  mono: "grayscale(1) contrast(1.05)",
};

function cfg<T>(config: Record<string, unknown> | undefined, key: string, fallback: T): T {
  const value = config?.[key];
  return (value === undefined || value === null || value === "" ? fallback : value) as T;
}

/** Hebrew-friendly quote/emphasis: lines become separate spans so rag stays balanced. */
function lines(text: string): string {
  return escapeHtml(text.trim())
    .split("\n")
    .map((line) => (line.trim() ? `<span class="line">${line}</span>` : `<span class="gap"></span>`))
    .join("");
}

function baseCss(input: RenderInput): string {
  const { settings: s, format } = input;
  const { width, height } = canvasSize(format);
  const safe = format === "story" ? s.storySafe : s.carouselSafe;
  return `
${input.fontCss}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden}
body{
  --paper:${s.colors.paper};--ink:${s.colors.ink};--accent:${s.colors.accent};--muted:${s.colors.muted};
  --note:${s.colors.note};--hl:${s.colors.highlight};
  --display:'${s.fonts.display}','Frank Ruhl Libre',serif;--text:'${s.fonts.text}','Heebo',sans-serif;
  --xl:${s.textSizes.xl}px;--lg:${s.textSizes.lg}px;--md:${s.textSizes.md}px;--sm:${s.textSizes.sm}px;
  --space:${s.spacing}px;--radius:${s.radius}px;
  --safe-top:${safe.top}px;--safe-bottom:${safe.bottom}px;--safe-side:${safe.side}px;
  background:var(--paper);color:var(--ink);font-family:var(--text);
  direction:rtl;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;
}
.canvas{position:relative;width:${width}px;height:${height}px;overflow:hidden}
.safe{position:absolute;inset:var(--safe-top) var(--safe-side) var(--safe-bottom) var(--safe-side);display:flex;flex-direction:column}
.copy{font-family:var(--display);font-weight:500;letter-spacing:-0.005em;text-wrap:balance;unicode-bidi:plaintext}
.copy .line{display:block}
.copy .gap{display:block;height:0.55em}
.size-xl{font-size:var(--xl);line-height:1.12}
.size-lg{font-size:var(--lg);line-height:1.16}
.size-md{font-size:var(--md);line-height:1.24}
.size-sm{font-size:var(--sm);line-height:1.38}
.sub{font-family:var(--text);font-size:calc(var(--sm) * 0.9);color:var(--muted);margin-top:28px;line-height:1.4;unicode-bidi:plaintext}
.ident{position:absolute;inset-inline-start:var(--safe-side);bottom:calc(var(--safe-bottom) * 0.42);font-family:var(--display);font-size:34px;letter-spacing:0.01em;color:var(--muted);direction:ltr}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:${IMAGE_FILTER[s.imageTreatment]}}
.sticker-space{margin-top:56px;min-height:280px;border-radius:calc(var(--radius) * 0.9)}
.guide .sticker-space{border:4px dashed color-mix(in srgb,var(--muted) 60%,transparent);display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--muted);font-family:var(--text)}
.guide .safe-outline{position:absolute;inset:var(--safe-top) var(--safe-side) var(--safe-bottom) var(--safe-side);outline:3px dashed rgba(47,69,198,.35);pointer-events:none}
.slider-emoji{font-size:120px;margin-top:40px;line-height:1}
`;
}

// ---------------------------------------------------------------------------
// families

type Parts = { css: string; body: string };

function stickerArea(frame: RenderFrame, guides: boolean | undefined): string {
  if (frame.kind === "poll") {
    // Instagram's own interactive poll is added in the app, so the graphic leaves room for it.
    return `<div class="sticker-space">${guides ? "כאן מוסיפים את הסקר באינסטגרם" : ""}</div>`;
  }
  if (frame.kind === "question") return `<div class="sticker-space">${guides ? "כאן מוסיפים תיבת שאלה" : ""}</div>`;
  if (frame.kind === "slider") return `<div class="slider-emoji">${escapeHtml(frame.emoji || "😅")}</div><div class="sticker-space" style="min-height:160px">${guides ? "כאן מוסיפים סליידר" : ""}</div>`;
  return "";
}

function textMessage(input: RenderInput): Parts {
  const { frame } = input;
  const align = cfg<string>(input.config, "align", "start");
  const step = sizeStep(frame.text);
  return {
    css: `.safe{justify-content:center;text-align:${align === "center" ? "center" : "start"}}`,
    body: `<div class="safe">
      <div class="copy size-${step}">${lines(frame.text)}</div>
      ${frame.subtext ? `<div class="sub">${escapeHtml(frame.subtext)}</div>` : ""}
      ${stickerArea(frame, input.guides)}
    </div>`,
  };
}

function question(input: RenderInput): Parts {
  const { frame } = input;
  const background = cfg<string>(input.config, "background", "ink");
  const bg = background === "pen" ? "var(--accent)" : background === "ink" ? "var(--ink)" : "var(--paper)";
  const fg = background === "paper" ? "var(--ink)" : "#fff";
  const step = sizeStep(frame.text);
  return {
    css: `body{background:${bg};color:${fg}} .sub{color:${background === "paper" ? "var(--muted)" : "rgba(255,255,255,.72)"}}
      .safe{justify-content:center;text-align:center;align-items:center}
      .q-mark{font-family:var(--display);font-size:200px;line-height:.8;opacity:.18;margin-bottom:24px}
      .ident{color:${background === "paper" ? "var(--muted)" : "rgba(255,255,255,.6)"}}
      .guide .sticker-space{border-color:rgba(255,255,255,.5);color:rgba(255,255,255,.75)}`,
    body: `<div class="safe">
      <div class="q-mark" aria-hidden="true">?</div>
      <div class="copy size-${step}" style="max-width:860px">${lines(frame.text)}</div>
      ${frame.subtext ? `<div class="sub">${escapeHtml(frame.subtext)}</div>` : ""}
      ${stickerArea(frame, input.guides)}
    </div>`,
  };
}

function notes(input: RenderInput): Parts {
  const { frame, format } = input;
  const items = frame.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const isList = items.length >= 3;
  const title = isList ? items[0] : "";
  const rest = isList ? items.slice(1) : [];
  const ruled = cfg<string>(input.config, "paper", "lined") === "lined";
  return {
    css: `body{background:var(--note)}
      .canvas{${ruled ? `background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 95px,color-mix(in srgb,var(--ink) 9%,transparent) 95px,color-mix(in srgb,var(--ink) 9%,transparent) 97px);background-position:0 ${format === "story" ? 310 : 170}px` : ""}}
      .note-head{display:flex;justify-content:space-between;align-items:center;font-family:var(--text);font-size:34px;color:var(--muted);margin-bottom:56px}
      .note-title{font-family:var(--text);font-weight:700;font-size:calc(var(--lg) * .9);line-height:1.2;margin-bottom:36px;unicode-bidi:plaintext}
      .note-list{list-style:none;display:flex;flex-direction:column;gap:22px}
      .note-list li{font-family:var(--text);font-size:calc(var(--md) * .88);line-height:1.35;padding-inline-start:56px;position:relative;unicode-bidi:plaintext}
      .note-list li::before{content:"";position:absolute;inset-inline-start:0;top:.42em;width:30px;height:30px;border-radius:50%;border:3px solid color-mix(in srgb,var(--ink) 45%,transparent)}
      .note-copy{font-family:var(--text);font-weight:500}`,
    body: `<div class="safe">
      <div class="note-head"><span>פתקים</span><span dir="ltr">Before I Do</span></div>
      ${
        isList
          ? `<div class="note-title">${escapeHtml(title)}</div><ul class="note-list">${rest.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
          : `<div class="copy note-copy size-${sizeStep(frame.text)}">${lines(frame.text)}</div>`
      }
      ${stickerArea(frame, input.guides)}
    </div>`,
  };
}

function conversation(input: RenderInput): Parts {
  const { frame } = input;
  const startLabel = cfg<string>(input.config, "leftLabel", "אני");
  const endLabel = cfg<string>(input.config, "rightLabel", "הוא");
  // "אני: ...\nהוא: ..." or two lines
  const parts = frame.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const bubbles = parts.map((line, i) => {
    const match = line.match(/^([^:]{1,14}):\s*(.+)$/);
    const speaker = match ? match[1] : i % 2 === 0 ? startLabel : endLabel;
    const said = match ? match[2] : line;
    const mine = match ? speaker === startLabel : i % 2 === 0;
    return { speaker, said, mine };
  });
  return {
    css: `.safe{justify-content:center;gap:40px}
      .bubble-row{display:flex;flex-direction:column;gap:10px}
      .bubble-row.mine{align-items:flex-start}
      .bubble-row.theirs{align-items:flex-end}
      .who{font-family:var(--text);font-size:34px;color:var(--muted);padding-inline:12px}
      .bubble{max-width:780px;padding:34px 44px;border-radius:48px;font-family:var(--text);font-size:calc(var(--md) * .95);line-height:1.3;unicode-bidi:plaintext}
      .mine .bubble{background:var(--ink);color:var(--paper);border-start-start-radius:14px}
      .theirs .bubble{background:#fff;color:var(--ink);border-start-end-radius:14px;box-shadow:0 2px 0 rgba(0,0,0,.04)}`,
    body: `<div class="safe">
      ${bubbles
        .map(
          (b) => `<div class="bubble-row ${b.mine ? "mine" : "theirs"}"><div class="who">${escapeHtml(b.speaker)}</div><div class="bubble">${escapeHtml(b.said)}</div></div>`,
        )
        .join("")}
      ${stickerArea(frame, input.guides)}
    </div>`,
  };
}

function photoFamily(input: RenderInput, product: boolean): Parts {
  const { frame, imageUrl } = input;
  const position = cfg<string>(input.config, "textPosition", product ? "top" : "bottom") as "top" | "bottom";
  const scrim = cfg<string>(input.config, "scrim", "soft");
  const step = sizeStep(frame.text);
  const shade = scrim === "none" ? "transparent" : scrim === "strong" ? "rgba(0,0,0,.62)" : "rgba(0,0,0,.42)";
  const gradient =
    position === "top"
      ? `linear-gradient(to bottom, ${shade} 0%, transparent 46%)`
      : `linear-gradient(to top, ${shade} 0%, transparent 52%)`;
  return {
    css: `body{background:#2a2a2a;color:#fff}
      .scrim{position:absolute;inset:0;background:${gradient}}
      .safe{justify-content:${position === "top" ? "flex-start" : "flex-end"}}
      .copy{text-shadow:0 2px 24px rgba(0,0,0,.28)}
      .sub{color:rgba(255,255,255,.82)}
      .ident{color:rgba(255,255,255,.72);${position === "bottom" ? "bottom:auto;top:calc(var(--safe-top) * .55)" : ""}}
      .no-photo{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,#3a3a3a 0 40px,#343434 40px 80px);color:rgba(255,255,255,.55);font-size:36px;font-family:var(--text)}`,
    body: `${
      imageUrl
        ? `<img class="photo" src="${escapeHtml(imageUrl)}" alt="" crossorigin="anonymous" />`
        : `<div class="no-photo">${input.guides ? "בחרי תמונה מהגלריה" : ""}</div>`
    }
      <div class="scrim"></div>
      <div class="safe">
        <div class="copy size-${step === "xl" ? "lg" : step}">${lines(frame.text)}</div>
        ${frame.subtext ? `<div class="sub">${escapeHtml(frame.subtext)}</div>` : ""}
        ${stickerArea(frame, input.guides)}
      </div>`,
  };
}

function carouselEditorial(input: RenderInput): Parts {
  const { frame } = input;
  const index = frame.index ?? 0;
  const total = frame.total ?? 1;
  const role = frame.role ?? (index === 0 ? "cover" : index === total - 1 ? "final" : "body");
  const numbering = cfg<boolean>(input.config, "numbering", true);
  // small variations between slides keep a series alive without a new template
  const variant = role === "cover" ? "cover" : role === "final" ? "final" : index % 2 === 0 ? "even" : "odd";
  const step = role === "cover" ? (sizeStep(frame.text) === "sm" ? "md" : "lg") : sizeStep(frame.text);
  return {
    css: `.safe{justify-content:${role === "cover" ? "flex-end" : "center"}}
      .num{position:absolute;top:calc(var(--safe-top) * .9);inset-inline-start:var(--safe-side);font-family:var(--display);font-size:40px;color:var(--muted);direction:ltr}
      .rule{width:120px;height:8px;background:var(--hl);margin-bottom:44px;border-radius:4px}
      .cover .copy{font-weight:700}
      .final{background:var(--ink);color:var(--paper)}
      .final .sub,.final .num,.final .ident{color:color-mix(in srgb,var(--paper) 70%,transparent)}
      .even .copy{padding-inline-start:24px;border-inline-start:8px solid var(--hl)}
      .swipe{position:absolute;bottom:calc(var(--safe-bottom) * .55);inset-inline-end:var(--safe-side);font-family:var(--text);font-size:32px;color:var(--muted)}`,
    body: `<div class="canvas-inner ${variant}" style="position:absolute;inset:0;${variant === "final" ? "background:var(--ink)" : ""}">
      ${numbering && role !== "cover" ? `<div class="num">${index + 1}/${total}</div>` : ""}
      <div class="safe">
        ${role === "cover" ? `<div class="rule"></div>` : ""}
        <div class="copy size-${step}">${lines(frame.text)}</div>
        ${frame.subtext ? `<div class="sub">${escapeHtml(frame.subtext)}</div>` : ""}
      </div>
      ${role === "cover" && total > 1 ? `<div class="swipe">החליקו ←</div>` : ""}
    </div>`,
  };
}

const FAMILY_RENDERERS: Record<TemplateFamily, (input: RenderInput) => Parts> = {
  text_message: textMessage,
  real_photo: (i) => photoFamily(i, false),
  product_in_life: (i) => photoFamily(i, true),
  notes,
  conversation,
  question,
  carousel_editorial: carouselEditorial,
};

/** Full standalone HTML document for one frame. */
export function renderDocument(input: RenderInput): string {
  const parts = FAMILY_RENDERERS[input.family](input);
  const { settings, family } = input;
  const showIdent =
    settings.identifier.show && family !== "carousel_editorial" && !(family === "question" && input.frame.kind === "question");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>${baseCss(input)}${parts.css}</style></head>
<body class="${input.guides ? "guide" : ""}"><div class="canvas">${parts.body}${
    showIdent ? `<div class="ident">${escapeHtml(settings.identifier.text)}</div>` : ""
  }${input.guides ? `<div class="safe-outline"></div>` : ""}</div></body></html>`;
}
