import { FEEDBACK_LABEL, FORMAT_LABEL, type ContentFormat, type FeedbackKind } from "@/lib/domain/constants";

// Task instructions per format. Small, explicit, and separate from brand context.

const FORMAT_RULES: Record<ContentFormat, string> = {
  story: "סטורי אחד: frames עם פריים אחד או שניים. אם יש שאלה לקהל, הפריים האחרון הוא poll עם 2 תשובות קצרות או question.",
  story_sequence: "רצף סטוריז של 2 עד 5 פריימים. קצב: פריים ראשון עוצר, כל פריים משפט אחד, הפריים האחרון poll או question. לא פסקה בשום פריים.",
  carousel: "קרוסלה של 4 עד 8 שקפים (slides). שקף ראשון חזק שעוצר גלילה, מחשבה אחת בכל שקף, שקף אחרון שסוגר או שואל. בלי מספור בתוך הטקסט.",
  pov_reel: "ריל POV: pov עם טקסט על המסך שמתחיל ב-POV או כש..., מה עושים בפריים צעד אחר צעד, אורך 5 עד 8 שניות, לוקיישן יומיומי, אביזרים. בלי דיאלוג.",
  talking_reel: "ריל דיבור למצלמה: pov.onScreenText הוא ההוק, pov.action הוא מה שאומרים (3-5 משפטים קצרים בגוף ראשון, כמו לחברה), אורך 15 עד 25 שניות, בבית, בלי סטודיו.",
  reel: "ריל קצר: pov עם מה רואים ומה עושים, טקסט על המסך, אורך ולוקיישן.",
  post: "פוסט: hook קצר שיופיע על התמונה או מתחתיה, caption של משפט או שניים, תמונה אמיתית מהגלריה.",
  question: "סטורי שאלה: פריים אחד מסוג question עם שאלה אחת שאפשר לענות עליה במשפט.",
  poll: "סטורי סקר: פריים אחד מסוג poll עם שאלה ו-2 תשובות קצרות שכל אחת מהן היא צד אמיתי.",
};

export function generationTask(input: {
  text: string;
  format: ContentFormat | null;
  count: 1 | 3;
  pillarHint?: string | null;
  fromAudience?: boolean;
}): string {
  const formatLine = input.format
    ? `פורמט: ${FORMAT_LABEL[input.format]} (${input.format}). ${FORMAT_RULES[input.format]}`
    : "בחרי את הפורמט שהכי מתאים לרעיון (pov_reel, story_sequence, carousel, poll, post...) ופעלי לפי הכללים שלו.";
  const directions =
    input.count === 3
      ? "כתבי 3 כיוונים שונים באמת, לא וריאציות קטנות של אותו משפט: 1) מצחיק ומודע לעצמו 2) אישי, מהצד שלנו כמותג קטן או מהחוויה של זוג 3) תצפית חדה ושקטה. כל כיוון עם direction משלו."
      : "כתבי כיוון אחד, הכי טוב שיש.";
  return [
    `מה קרה / על מה מדברים:\n"""${input.text.trim()}"""`,
    input.fromAudience ? "זה משפט אמיתי מהקהל. אפשר להשתמש בשפה שלו (בלי פרטים מזהים). שפת הקהל לרוב טובה יותר משלנו." : "",
    formatLine,
    input.pillarHint ? `עמוד תוכן מועדף: ${input.pillarHint}` : "בחרי pillarKey מתוך רשימת עמודי התוכן.",
    directions,
    "frames רק לסטוריז/שאלה/סקר/פוסט, slides רק לקרוסלה, pov רק לרילים; השאר ריקים (או null).",
    "assetTags: עד 4 תגיות מהרשימה בהקשר שמתאימות לתמונה אמיתית מהגלריה. templateFamily: התבנית שהכי מתאימה.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const REWRITE_INSTRUCTION: Record<FeedbackKind, string> = {
  more_personal: "יותר אישי: יותר קרוב, בגוף ראשון או מהחוויה של הזוג, פרט אחד שמרגיש אמיתי. בלי להמציא אירועים.",
  less_promotional: "פחות פרסומי: להוריד כל ריח של מכירה. אם המוצר לא חייב להיות שם, להוציא אותו.",
  funnier: "יותר מצחיק: הומור של זיהוי, לא בדיחה. טוויסט קטן בסוף משפט. לא להקטין אף אחד.",
  sharper: "יותר חד: לקצר, להוריד מילים מיותרות, משפט שמכה בפעם הראשונה.",
  more_natural: "יותר טבעי: כמו שמדברים באמת בוואטסאפ, בלי ניסוחים של כתיבה.",
  other_direction: "כיוון אחר לגמרי: אותו נושא, זווית שונה (אם זה היה מצחיק, עכשיו תצפית; אם עצה, עכשיו רגע).",
  this_is_us: "",
  not_us: "",
};

export function rewriteTask(current: string, kind: FeedbackKind, format: ContentFormat): string {
  return [
    `הטקסט הנוכחי (${FORMAT_LABEL[format]}):\n"""${current}"""`,
    `הבקשה: ${FEEDBACK_LABEL[kind]}. ${REWRITE_INSTRUCTION[kind]}`,
    `שמרי על אותו פורמט (${format}) ואותו נושא. ${FORMAT_RULES[format]}`,
    "החזירי כיוון אחד.",
  ].join("\n\n");
}

export function evaluationTask(copy: string): string {
  return `דרגי את הטקסט הבא בסולם 1-100 לפי: שפה טבעית, ספציפיות, זיהוי עצמי, קול אישי, בלי לחץ שיווקי, בא לשלוח, מתאים לנו.\nהשתמשי בדוגמאות הטובות והרעות שבהקשר כמדד. היי קשוחה: טקסט שמותג חתונות אחר היה יכול לפרסם לא עובר 60.\n\n"""${copy}"""`;
}

export function audienceTask(text: string): string {
  return `זה משפט אמיתי שזוג מאורס כתב לנו:\n"""${text}"""\n\nהציעי 3 הוקים שמשתמשים בשפה ובמצב שלו (לא בפרטים המזהים), כל אחד לפורמט אחר. ספציפי, מצחיק בעדינות כשמתאים, לא עצה.`;
}
