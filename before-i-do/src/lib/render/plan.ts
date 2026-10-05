import type { ContentBody, StoryFrame } from "@/lib/domain/content-body";
import type { ContentFormat } from "@/lib/domain/constants";
import type { DesignSettings } from "./design-settings";
import { renderDocument, type RenderFormat, type RenderFrame, type RenderInput } from "./document";
import { isTemplateFamily, type TemplateFamily } from "./families";

export type TemplateLite = { id: string; family: string; name: string; config: unknown };

export type RenderableContent = {
  format: ContentFormat;
  hook: string | null;
  body: ContentBody;
  template_id: string | null;
};

export type PlannedFrame = {
  key: string;
  label: string;
  input: Omit<RenderInput, "fontCss" | "guides">;
};

/** Default family for a Story frame when nothing is chosen. */
export function defaultFamilyForFrame(frame: Pick<StoryFrame, "kind">, hasPhoto: boolean): TemplateFamily {
  if (frame.kind === "poll" || frame.kind === "question" || frame.kind === "slider") return "question";
  if (frame.kind === "product") return hasPhoto ? "product_in_life" : "text_message";
  if ((frame.kind === "photo" || frame.kind === "video") && hasPhoto) return "real_photo";
  return "text_message";
}

/**
 * A piece-level template only applies where it makes sense: the question card is for
 * interactive frames, photo templates need a photo. A per-frame choice always wins.
 */
function familyFits(family: TemplateFamily, kind: StoryFrame["kind"], hasPhoto: boolean, explicit: boolean): boolean {
  if (explicit) return true;
  const interactive = kind === "poll" || kind === "question" || kind === "slider";
  if (family === "question") return interactive;
  if (family === "real_photo" || family === "product_in_life") return hasPhoto;
  return true;
}

export function hasGraphics(format: ContentFormat): boolean {
  return ["story", "story_sequence", "carousel", "question", "poll", "post"].includes(format);
}

/**
 * Every frame/slide of a piece as renderer input. Photos resolve through `assetUrl`
 * (signed URLs in the browser, data URIs or signed URLs on the server).
 */
export function planFrames(
  content: RenderableContent,
  templates: TemplateLite[],
  settings: DesignSettings,
  assetUrl: (assetId: string) => string | null | undefined,
): PlannedFrame[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const pieceTemplate = content.template_id ? byId.get(content.template_id) : undefined;

  if (content.format === "carousel") {
    const slides = content.body.slides?.length ? content.body.slides : content.hook ? [{ id: "hook", role: "cover" as const, text: content.hook }] : [];
    return slides.map((slide, index) => {
      const imageUrl = slide.assetId ? (assetUrl(slide.assetId) ?? null) : null;
      let family: TemplateFamily = pieceTemplate && isTemplateFamily(pieceTemplate.family) ? pieceTemplate.family : "carousel_editorial";
      if (imageUrl && family === "carousel_editorial") family = "real_photo";
      if (family === "question") family = "carousel_editorial";
      const frame: RenderFrame = { kind: "slide", text: slide.text, subtext: slide.subtext, index, total: slides.length, role: slide.role };
      return {
        key: slide.id,
        label: index === 0 ? "שקף פתיחה" : index === slides.length - 1 ? "שקף אחרון" : `שקף ${index + 1}`,
        input: { format: "carousel" as RenderFormat, family, frame, settings, imageUrl, config: (pieceTemplate?.config ?? {}) as Record<string, unknown> },
      };
    });
  }

  if (!hasGraphics(content.format)) return [];

  const frames: StoryFrame[] = content.body.frames?.length
    ? content.body.frames
    : content.hook
      ? [{ id: "hook", kind: content.format === "poll" ? "poll" : content.format === "question" ? "question" : "text", text: content.hook }]
      : [];

  return frames
    .filter((f) => f.text.trim() || f.assetId)
    .map((frame, index) => {
      const imageUrl = frame.assetId ? (assetUrl(frame.assetId) ?? null) : null;
      const chosen = frame.templateId ? byId.get(frame.templateId) : pieceTemplate;
      let family: TemplateFamily =
        chosen && isTemplateFamily(chosen.family) && familyFits(chosen.family, frame.kind, Boolean(imageUrl), Boolean(frame.templateId))
          ? chosen.family
          : defaultFamilyForFrame(frame, Boolean(imageUrl));
      if (family === "carousel_editorial") family = "text_message";
      return {
        key: frame.id,
        label: `פריים ${index + 1}`,
        input: {
          format: "story" as RenderFormat,
          family,
          frame: { kind: frame.kind, text: frame.text, subtext: frame.subtext, options: frame.options, emoji: frame.emoji },
          settings,
          imageUrl,
          config: (chosen?.config ?? {}) as Record<string, unknown>,
        },
      };
    });
}

export function documentsFor(frames: PlannedFrame[], fontCss: string, guides = false): string[] {
  return frames.map((f) => renderDocument({ ...f.input, fontCss, guides }));
}
