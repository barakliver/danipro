import { z } from "zod";

// Format-specific structure stored in content_items.body.
// One shared shape with optional sections keeps a single editor and lets a piece
// change format (e.g. a POV gets a supporting Story sequence) without migrations.

export const STORY_ELEMENT_KINDS = ["text", "photo", "video", "poll", "question", "slider", "cta", "product"] as const;
export type StoryElementKind = (typeof STORY_ELEMENT_KINDS)[number];

export const STORY_ELEMENT_LABEL: Record<StoryElementKind, string> = {
  text: "טקסט",
  photo: "תמונה",
  video: "וידאו",
  poll: "סקר",
  question: "תיבת שאלה",
  slider: "סליידר אימוג׳י",
  cta: "הנעה לפעולה",
  product: "המשחק בפריים",
};

const id = z.string().min(1);

export const storyFrameSchema = z.object({
  id,
  kind: z.enum(STORY_ELEMENT_KINDS).default("text"),
  text: z.string().default(""),
  /** small secondary line, e.g. who said it */
  subtext: z.string().optional(),
  /** poll answers (2) */
  options: z.array(z.string()).optional(),
  /** emoji for the slider sticker */
  emoji: z.string().optional(),
  assetId: z.string().optional(),
  templateId: z.string().optional(),
  notes: z.string().optional(),
});
export type StoryFrame = z.infer<typeof storyFrameSchema>;

export const CAROUSEL_ROLES = ["cover", "body", "final"] as const;
export const carouselSlideSchema = z.object({
  id,
  role: z.enum(CAROUSEL_ROLES).default("body"),
  text: z.string().default(""),
  subtext: z.string().optional(),
  assetId: z.string().optional(),
  notes: z.string().optional(),
});
export type CarouselSlide = z.infer<typeof carouselSlideSchema>;

export const povSchema = z.object({
  onScreenText: z.string().default(""),
  shot: z.string().default(""),
  /** what I physically do in frame */
  action: z.string().default(""),
  length: z.string().default(""),
  location: z.string().default(""),
  props: z.array(z.string()).default([]),
  gameAppears: z.boolean().default(false),
  sound: z.string().optional(),
  outfit: z.string().optional(),
  cameraSetup: z.string().optional(),
});
export type Pov = z.infer<typeof povSchema>;

export const contentBodySchema = z.object({
  frames: z.array(storyFrameSchema).optional(),
  slides: z.array(carouselSlideSchema).optional(),
  pov: povSchema.optional(),
  /** template variant overrides for this piece */
  templateVariant: z.string().optional(),
});
export type ContentBody = z.infer<typeof contentBodySchema>;

/** Lenient parse: corrupted or legacy bodies never crash the editor. */
export function parseContentBody(value: unknown): ContentBody {
  const result = contentBodySchema.safeParse(value ?? {});
  return result.success ? result.data : {};
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function newFrame(partial: Partial<StoryFrame> = {}): StoryFrame {
  return { id: newId(), kind: "text", text: "", ...partial };
}

export function newSlide(partial: Partial<CarouselSlide> = {}): CarouselSlide {
  return { id: newId(), role: "body", text: "", ...partial };
}

export const CAROUSEL_MIN_SLIDES = 3;
export const CAROUSEL_MAX_SLIDES = 10;
export const STORY_MAX_FRAMES = 5;

/** Ensure cover/final roles follow position after edits and reorders. */
export function normalizeSlideRoles(slides: CarouselSlide[]): CarouselSlide[] {
  return slides.map((slide, index) => ({
    ...slide,
    role: index === 0 ? "cover" : index === slides.length - 1 && slides.length > 1 ? "final" : "body",
  }));
}

/** All human-visible copy of a piece, for scoring, memory and "copy text". */
export function collectCopy(input: {
  hook?: string | null;
  caption?: string | null;
  cta?: string | null;
  body: ContentBody;
}): string[] {
  const parts: string[] = [];
  if (input.hook) parts.push(input.hook);
  for (const frame of input.body.frames ?? []) {
    if (frame.text) parts.push(frame.text);
    for (const option of frame.options ?? []) if (option) parts.push(option);
  }
  for (const slide of input.body.slides ?? []) if (slide.text) parts.push(slide.text);
  if (input.body.pov?.onScreenText && input.body.pov.onScreenText !== input.hook) parts.push(input.body.pov.onScreenText);
  if (input.caption) parts.push(input.caption);
  if (input.cta) parts.push(input.cta);
  return parts;
}
