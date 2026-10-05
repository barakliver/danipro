export const TEMPLATE_FAMILIES = [
  "text_message",
  "real_photo",
  "notes",
  "conversation",
  "question",
  "product_in_life",
  "carousel_editorial",
] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

export const FAMILY_LABEL: Record<TemplateFamily, string> = {
  text_message: "הודעה",
  real_photo: "תמונה אמיתית",
  notes: "פתק",
  conversation: "שיחה",
  question: "שאלה",
  product_in_life: "המשחק בחיים",
  carousel_editorial: "קרוסלה עריכתית",
};

/** Families that need a Gallery photo to look right. */
export const PHOTO_FAMILIES: ReadonlySet<TemplateFamily> = new Set(["real_photo", "product_in_life"]);

export function isTemplateFamily(value: unknown): value is TemplateFamily {
  return typeof value === "string" && (TEMPLATE_FAMILIES as readonly string[]).includes(value);
}
