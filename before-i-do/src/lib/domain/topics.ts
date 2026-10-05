// Shared topic taxonomy. Used by the importer (topic_tags), content memory
// (repetition warnings), analytics patterns and asset recommendations, so
// "רשימת מוזמנים" means the same thing everywhere.

export type TopicKey =
  | "guest_list"
  | "budget"
  | "family"
  | "wedding_size"
  | "venue"
  | "vendors"
  | "date"
  | "priorities"
  | "decisions"
  | "expectations"
  | "arguments"
  | "food"
  | "ceremony"
  | "honeymoon"
  | "kids"
  | "planning_fatigue"
  | "engagement"
  | "product"
  | "behind_scenes";

type TopicDef = { key: TopicKey; label: string; patterns: RegExp[] };

export const TOPICS: readonly TopicDef[] = [
  { key: "guest_list", label: "רשימת מוזמנים", patterns: [/מוזמנ/, /אורח/, /פלוס אחד/, /אישור הגעה/, /להזמין/] },
  { key: "budget", label: "תקציב וכסף", patterns: [/תקציב/, /כסף/, /מחיר/, /ש״ח|ש"ח|שקל/, /מקדמה/, /הוצא(ה|ות)/, /אקסל/, /חיסכון/, /עולה/] },
  { key: "family", label: "הורים ומשפחה", patterns: [/הורים/, /אמא/, /אבא/, /משפח/, /מסורת/] },
  { key: "wedding_size", label: "גודל החתונה", patterns: [/חתונה קטנה/, /קטנה זה/, /כמה גדולה/, /כמה אנשים/] },
  { key: "venue", label: "אולם", patterns: [/אולם/] },
  { key: "vendors", label: "ספקים", patterns: [/ספק/, /צלם/, /הצעת מחיר/, /הצעות מחיר/] },
  { key: "date", label: "תאריך", patterns: [/תאריך/, /יום חמישי/, /חמישי יקר/] },
  { key: "priorities", label: "מה חשוב לנו", patterns: [/חשוב/, /מתפשר/, /פשרה/, /חובה/] },
  { key: "decisions", label: "החלטות", patterns: [/החלט/, /להחליט/] },
  { key: "expectations", label: "ציפיות", patterns: [/ציפיות/, /מצפ/] },
  { key: "arguments", label: "ויכוחים", patterns: [/ויכוח/, /ריב/, /רבים/] },
  { key: "food", label: "אוכל", patterns: [/אוכל/, /טעימות/] },
  { key: "ceremony", label: "חופה וטקס", patterns: [/חופה/, /טקס(?!ט)/, /שיר חופה/] },
  { key: "honeymoon", label: "ירח דבש", patterns: [/ירח דבש/] },
  { key: "kids", label: "ילדים בחתונה", patterns: [/ילדים/] },
  { key: "planning_fatigue", label: "עייפות מתכנון", patterns: [/הפסקת תכנון/, /אסור לדבר/, /ישיבת תכנון/, /שיחת חתונה/] },
  { key: "engagement", label: "אירוסים", patterns: [/אירוסים/, /התארסתם/, /מאורס/] },
  { key: "product", label: "המשחק", patterns: [/Before I Do/i, /קלפים/, /קלף/, /קופס/, /המשחק/] },
  { key: "behind_scenes", label: "מאחורי הקלעים", patterns: [/בית הדפוס/, /קרטונים/, /אריזה/, /משלוח/, /מילואים/] },
];

const LABEL = new Map(TOPICS.map((t) => [t.key, t.label]));

export function topicLabel(key: string): string {
  return LABEL.get(key as TopicKey) ?? key;
}

export function isTopicKey(value: string): value is TopicKey {
  return LABEL.has(value as TopicKey);
}

/** Detect topics in any amount of Hebrew/English text. Order follows TOPICS. */
export function detectTopics(...texts: Array<string | null | undefined>): TopicKey[] {
  const haystack = texts.filter(Boolean).join("\n");
  if (!haystack) return [];
  return TOPICS.filter((t) => t.patterns.some((p) => p.test(haystack))).map((t) => t.key);
}
