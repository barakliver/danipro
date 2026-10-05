import { z } from "zod";
import { CONTENT_FORMATS } from "@/lib/domain/constants";
import { STORY_ELEMENT_KINDS } from "@/lib/domain/content-body";
import { TEMPLATE_FAMILIES } from "@/lib/render/families";

// What the model must return. Kept flat and explicit so structured outputs can
// enforce it; ids are added by our code, not invented by the model.

export const generatedFrameSchema = z.object({
  kind: z.enum(STORY_ELEMENT_KINDS),
  text: z.string(),
  options: z.array(z.string()).describe("Only for poll frames: 2 short answers"),
});

export const generatedPovSchema = z.object({
  onScreenText: z.string(),
  shot: z.string(),
  action: z.string().describe("What the person physically does in frame, beat by beat"),
  length: z.string(),
  location: z.string(),
  props: z.array(z.string()),
  gameAppears: z.boolean(),
  sound: z.string(),
});

export const generatedPieceSchema = z.object({
  direction: z.string().describe("Short Hebrew name of the angle, e.g. מצחיק / אישי / תצפית"),
  format: z.enum(CONTENT_FORMATS),
  pillarKey: z.string(),
  topic: z.string(),
  hook: z.string(),
  frames: z.array(generatedFrameSchema).describe("Story frames, empty for other formats"),
  slides: z.array(z.string()).describe("Carousel slides in order, cover first, empty for other formats"),
  pov: generatedPovSchema.nullable().describe("Only for POV / talking reels"),
  caption: z.string(),
  cta: z.string(),
  supportingStory: z.string(),
  productPresence: z.enum(["none", "natural", "direct"]),
  templateFamily: z.enum(TEMPLATE_FAMILIES),
  visualRecommendation: z.string(),
  assetTags: z.array(z.string()).describe("Gallery tags that would fit, from the provided tag list"),
  publishingContext: z.string().describe("When/why to post it, one sentence"),
});
export type GeneratedPiece = z.infer<typeof generatedPieceSchema>;

export const generationResultSchema = z.object({ pieces: z.array(generatedPieceSchema) });

export const evaluationSchema = z.object({
  // 1-100; range is checked in code (structured outputs keep schemas simple)
  score: z.number().int(),
  natural: z.number().int(),
  specific: z.number().int(),
  relatable: z.number().int(),
  personal: z.number().int(),
  low_pressure: z.number().int(),
  shareable: z.number().int(),
  brand_fit: z.number().int(),
  verdict: z.string().describe("One short Hebrew sentence: what would make it sound more like us"),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const audienceHooksSchema = z.object({ hooks: z.array(z.object({ hook: z.string(), format: z.enum(CONTENT_FORMATS), why: z.string() })) });
