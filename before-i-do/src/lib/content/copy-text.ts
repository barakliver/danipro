import type { ContentBody } from "@/lib/domain/content-body";

type CopySource = { hook: string | null; caption: string | null; cta: string | null; supporting_story?: string | null; body: ContentBody };

/** Caption as pasted into Instagram. */
export function captionText(c: Pick<CopySource, "caption" | "cta">): string {
  return [c.caption, c.cta].filter(Boolean).join("\n\n");
}

/** Story text frame by frame, poll answers included. */
export function storyText(c: Pick<CopySource, "body">): string {
  return (c.body.frames ?? [])
    .map((f) => [f.text, ...(f.options ?? []).filter(Boolean)].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

export function slidesText(c: Pick<CopySource, "body">): string {
  return (c.body.slides ?? []).map((s, i) => `${i + 1}. ${s.text}`).join("\n");
}

/** Everything in one file, shipped inside export ZIPs. */
export function copyBundle(c: CopySource): string {
  const parts: string[] = [];
  if (c.hook) parts.push(`הוק:\n${c.hook}`);
  const story = storyText(c);
  if (story) parts.push(`סטורי:\n${story}`);
  const slides = slidesText(c);
  if (slides) parts.push(`שקפים:\n${slides}`);
  const caption = captionText(c);
  if (caption) parts.push(`כיתוב:\n${caption}`);
  if (c.supporting_story) parts.push(`סטורי המשך:\n${c.supporting_story}`);
  return parts.join("\n\n---\n\n") + "\n";
}
