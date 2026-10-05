// "Sounds Like Us": a local, explainable evaluation of Hebrew copy.
// Runs without any AI provider; when a model is configured its evaluation is
// blended in (see lib/ai). Scores are a guide, not a gate.

export type VoiceDimension =
  | "natural"
  | "specific"
  | "relatable"
  | "personal"
  | "low_pressure"
  | "shareable"
  | "brand_fit";

export const DIMENSION_LABEL: Record<VoiceDimension, string> = {
  natural: "שפה טבעית",
  specific: "ספציפיות",
  relatable: "זיהוי עצמי",
  personal: "קול אישי",
  low_pressure: "בלי לחץ שיווקי",
  shareable: "בא לשלוח",
  brand_fit: "מתאים לנו",
};

const WEIGHTS: Record<VoiceDimension, number> = {
  natural: 1.2,
  specific: 1.4,
  relatable: 1.3,
  personal: 0.7,
  low_pressure: 1.3,
  shareable: 0.9,
  brand_fit: 1.2,
};

export type VoiceFlag = { code: string; message: string; suggestion: string };

export type VoiceScore = {
  score: number;
  dimensions: Array<{ key: VoiceDimension; label: string; value: number }>;
  flags: VoiceFlag[];
  source: "local" | "ai" | "blend";
};

const MARKETING = [
  /המשחק שכל/,
  /הגיע הזמן/,
  /זוג מאורס חייב|כל זוג (מאורס )?(חייב|צריך)/,
  /חייב(ים|ת)? (לנסות|להשיג|שיהיה)/,
  /הזדמנות/,
  /מושלמ/,
  /בלתי נשכח/,
  /קנו עכשיו|הזמינו עכשיו|רכשו/,
  /מבצע|הנחה/,
  /לשלב הבא/,
  /היום הגדול/,
  /חוויה (ייחודית|מיוחדת)/,
  /המתנה המושלמת/,
  /אל תפספס/,
  /מהפכ/,
];

const THERAPY = [/תקשורת (זוגית|טובה)/, /להעמיק/, /העמיקו/, /משמעותי/, /הקשר שלכם/, /זוגיות בריאה/, /לחזק את/, /רגשות/, /פגיעות/];

const CLICHE = [/כל חתונה מתחילה/, /אהבה אמיתית/, /לנצח/, /יחד לתמיד/, /רגעים משמעותיים/, /הדרך לחתונה/];

const SLANG = [/סחתיין/, /וואלה אחי/, /יאללה בלאגן/, /קרינג'/, /ביג טיים/, /פאקינג/];

const ADVICE_OPENERS = /(^|\n|[.!?]\s+)(צרו|העמיקו|דברו|תדברו|כדאי ל|חשוב ל|אל תשכחו|זכרו|הקפידו|נסו ל|תנו ל|קחו)/;

const SPOKEN = [/(^|\s)(אז|רגע|טוב|בקיצור|כאילו|נו|סתם|פשוט|ממש|לגמרי|איכשהו)(\s|,|$)/, /חח/, /😅|🙂|🙃|😂|🫠/, /(^|\s)(את|אתה|אתם|אתן)(\s|$)/];

const SPECIFIC = [
  /\d/,
  /אמא שלו|אמא שלה|אבא שלו|אבא שלה|ההורים|המשפחה|דודה|סבתא/,
  /אקסל|קבוצת (ה)?וואטסאפ|הצעת מחיר|מקדמה|טעימות|DJ|צלם|אולם|פלוס אחד|אישור הגעה|שיר חופה|פינטרסט/,
  /ש״ח|שקל/,
  /יום חמישי|שבת|בבוקר|בערב|השבוע/,
];

const RELATABLE = [/^כש|\nכש|(^|\s)כשה?/, /(^|\s)אם .{3,60}(היה|היו|הייתם|הייתן)/, /(^|\s)(הייתם|אתם|שלכם|לכם)(\s|,|\?|$)/, /POV/i, /גילית|גיליתם|גילינו/, /אצלו|אצלה|אצלכם|אצלנו/, /שניכם|שנינו/, /\?$/m];

const PERSONAL = [/(^|\s)(אני|אנחנו|שלנו|לנו|שלי|לי)(\s|,|\.|$)/, /ברק/, /מתרגשת|מתרגש/, /מילואים/, /הקופסאות/];

const SHARE = [/תשלח(י|ו)? (ל|את)/, /תייג(י|ו)/, /שלחו ל/, /מה אצלכם/, /שמרו/, /\?$/m];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function hits(patterns: RegExp[], text: string) {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
}

export type VoiceContext = {
  /** extra phrases to avoid, from Brand Brain "words we avoid" and bad examples */
  avoid?: string[];
  /** whether this piece is meant to sell (direct product content gets some slack) */
  productIntent?: "none" | "natural" | "direct";
};

export function scoreVoice(parts: string[], context: VoiceContext = {}): VoiceScore {
  const text = parts.filter(Boolean).join("\n").trim();
  if (!text) {
    return { score: 1, dimensions: (Object.keys(DIMENSION_LABEL) as VoiceDimension[]).map((k) => ({ key: k, label: DIMENSION_LABEL[k], value: 0 })), flags: [], source: "local" };
  }
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const avgWords = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0) / Math.max(1, sentences.length);
  const flags: VoiceFlag[] = [];

  const marketing = hits(MARKETING, text);
  const therapy = hits(THERAPY, text);
  const cliche = hits(CLICHE, text);
  const slang = hits(SLANG, text);
  const avoidHits = (context.avoid ?? []).filter((w) => w.length > 2 && text.includes(w));
  const exclamations = (text.match(/!/g) ?? []).length;
  const hashtags = (text.match(/#/g) ?? []).length;
  const productMentions = (text.match(/Before I Do|המשחק שלנו|הקלפים שלנו|הקופסה/g) ?? []).length;
  const advice = ADVICE_OPENERS.test(text);

  const natural = clamp(52 + hits(SPOKEN, text) * 11 + (avgWords <= 12 ? 14 : avgWords <= 18 ? 4 : -14) - exclamations * 4 - therapy * 10 - cliche * 12);
  const specific = clamp(30 + hits(SPECIFIC, text) * 17 + Math.min(2, (text.match(/\d+/g) ?? []).length) * 5 - cliche * 15 - (sentences.length > 0 && avgWords > 16 && hits(SPECIFIC, text) === 0 ? 15 : 0));
  const relatable = clamp(36 + hits(RELATABLE, text) * 13 + (hits(SPECIFIC, text) ? 8 : 0) - therapy * 10 - (advice ? 12 : 0));
  const personal = clamp(48 + hits(PERSONAL, text) * 16 - marketing * 8);
  const directSlack = context.productIntent === "direct" ? 12 : 0;
  const low_pressure = clamp(92 - marketing * 26 - Math.max(0, productMentions - 1) * 12 - exclamations * 5 - hashtags * 3 - avoidHits.length * 10 + directSlack);
  const shareable = clamp(42 + hits(SHARE, text) * 14 + (hits(RELATABLE, text) ? 10 : 0) + (text.length < 140 ? 8 : 0) - marketing * 10);
  const brand_fit = clamp(84 - therapy * 18 - cliche * 22 - slang * 18 - marketing * 12 - (advice ? 10 : 0) - avoidHits.length * 8);

  const values: Record<VoiceDimension, number> = { natural, specific, relatable, personal, low_pressure, shareable, brand_fit };
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let score = (Object.keys(values) as VoiceDimension[]).reduce((sum, k) => sum + values[k] * WEIGHTS[k], 0) / totalWeight;
  // hard signals of brand-speak cap the score
  if (marketing + therapy + cliche >= 2) score = Math.min(score, 42);
  else if (marketing + therapy + cliche === 1) score = Math.min(score, 58);

  if (marketing) flags.push({ code: "marketing", message: "נשמע כמו מותג שמדבר לצרכנים.", suggestion: "לספר את הרגע, לא את המוצר. אם המשחק לא חייב להיות פה, להוציא אותו." });
  if (therapy) flags.push({ code: "therapy", message: "שפה טיפולית או זוגית כללית.", suggestion: "להחליף מילים גדולות בסיטואציה אחת שקרתה באמת." });
  if (cliche) flags.push({ code: "cliche", message: "יש כאן קלישאה.", suggestion: "איזה פרט קטן רק אצלכם היה ככה?" });
  if (advice) flags.push({ code: "advice", message: "נשמע כמו עצה.", suggestion: "לנסות כתצפית: \"כש...\" במקום \"כדאי ל...\"." });
  if (specific < 45) flags.push({ code: "generic", message: "מותג חתונות אחר היה יכול לפרסם את זה.", suggestion: "להוסיף פרט: מספר, אדם, משפט שנאמר, מקום." });
  if (avgWords > 18) flags.push({ code: "long", message: "משפטים ארוכים.", suggestion: "לחתוך לשניים. ככה מדברים בוואטסאפ." });
  if (slang) flags.push({ code: "slang", message: "סלנג מוגזם.", suggestion: "גובה עיניים, לא צעקני." });
  if (avoidHits.length) flags.push({ code: "avoid", message: `מילים שהחלטנו להימנע מהן: ${avoidHits.slice(0, 3).join(", ")}`, suggestion: "להחליף במשהו שהיינו אומרים באמת." });
  if (productMentions > 1 && context.productIntent !== "direct") flags.push({ code: "product", message: "המוצר מוזכר יותר מפעם אחת.", suggestion: "פעם אחת, בטבעיות, או בכלל לא." });

  return {
    score: Math.max(1, clamp(score)),
    dimensions: (Object.keys(values) as VoiceDimension[]).map((k) => ({ key: k, label: DIMENSION_LABEL[k], value: values[k] })),
    flags,
    source: "local",
  };
}

export function scoreTone(score: number): "strong" | "ok" | "weak" {
  if (score >= 72) return "strong";
  if (score >= 55) return "ok";
  return "weak";
}
