import type { ContentFormat } from "@/lib/domain/constants";

export type FormatSuggestion = { format: ContentFormat; label: string; why: string };

/**
 * Which formats an idea naturally becomes. A moment ("כש...") is a POV; a question
 * is a Story; a list is a carousel; something that happened to us is a Story or post.
 */
export function suggestFormats(text: string, tags: string[] = []): FormatSuggestion[] {
  const t = text.trim();
  const out: FormatSuggestion[] = [];
  const lines = t.split("\n").filter((l) => l.trim()).length;
  if (/^כש|POV|(^|\s)כשה?/.test(t)) out.push({ format: "pov_reel", label: "POV", why: "זה רגע שאפשר לשחק מול המצלמה" });
  if (lines >= 3 || /^\d+\s|דברים ש/.test(t)) out.push({ format: "carousel", label: "קרוסלה", why: "יש כאן רשימה, מחשבה אחת בכל שקף" });
  if (/\?\s*$/.test(t) || /של מי|מה עושים|או/.test(t)) out.push({ format: "story_sequence", label: "סטורי עם סקר", why: "שאלה שהקהל יענה עליה" });
  if (tags.includes("מאחורי הקלעים") || tags.includes("אישי") || /אנחנו|ברק|קופסאות|הזמנה/.test(t))
    out.push({ format: "story", label: "סטורי אישי", why: "משהו שקרה לנו, בגובה העיניים" });
  if (tags.includes("הודעה מלקוח")) out.push({ format: "post", label: "פוסט", why: "מה שזוג כתב לנו, באנונימיות" });
  const fallback: FormatSuggestion[] = [
    { format: "story_sequence", label: "רצף סטוריז", why: "2 עד 4 פריימים, משפט בכל אחד" },
    { format: "pov_reel", label: "POV", why: "אם יש כאן רגע מוכר" },
    { format: "carousel", label: "קרוסלה", why: "אם יש כמה נקודות" },
    { format: "post", label: "פוסט", why: "תמונה אמיתית ומשפט אחד" },
  ];
  for (const f of fallback) if (!out.some((o) => o.format === f.format)) out.push(f);
  return out.slice(0, 4);
}
