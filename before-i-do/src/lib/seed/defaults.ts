import type { TemplateFamily } from "@/lib/render/families";

// Initial Brand Brain, templates and highlights for a new workspace.
// Personal facts here come only from what the founders provided. The generator may
// tell personal stories only from entries in the Brand Brain, never invented ones.

export type BrandSeed = { section: string; title?: string; body: string; pinned?: boolean; meta?: Record<string, string> };

export const BRAND_BRAIN_SEED: BrandSeed[] = [
  {
    section: "permanent_rules",
    title: "ההוראה הקבועה",
    pinned: true,
    body: "ספציפי מנצח מתוחכם.\nאנושי מנצח מלוטש.\nזיהוי מנצח הסבר.\nשיחה מנצחת שכנוע.\nלא להישמע ילדותי. בלי סלנג מוגזם. לא להכריח הומור.",
  },
  {
    section: "permanent_rules",
    title: "המבחן",
    pinned: true,
    body: "האם אדם אמיתי היה אומר את זה? יש כאן סיטואציה ספציפית ומוכרת? מאורסת תזהה את עצמה? זה נשמע כמו עצה כשזה יכול להיות תצפית? המוצר נדחף לתוכן? הייתי שולחת את זה לבן הזוג או לחברה? ואם מותג חתונות אחר יכול לפרסם בדיוק את אותו משפט, צריך להיות יותר ספציפיים.",
  },
  {
    section: "who_we_are",
    title: "Before I Do",
    body: "משחק קלפים של שיחות לזוגות מאורסים. ערב אחד שבו עוצרים את התכנון ומדברים על הדברים שיושבים מתחת להחלטות: אולם, רשימת מוזמנים, תקציב, ספקים ומעורבות המשפחה. זה לא טיפול, זה לא מוצר לשיפור הזוגיות ואנחנו לא אומרים לאף אחד שיש לו בעיה. זה פשוט משהו שבא לעשות יחד אחרי שמתארסים.",
  },
  {
    section: "who_we_are",
    title: "העיקרון",
    body: "Before I Do צריך להרגיש כמו מישהו שמבין איך באמת מרגישים כשמאורסים. שיגידו: זה ממש אנחנו. הקהל צריך לזהות את עצמו לפני שהוא מזהה שזה תוכן ממותג. אנחנו לא מנסים להישמע חכמים ולא מלמדים איך זוגיות עובדת. אנחנו שמים לב לרגעים ספציפיים בתכנון חתונה ואומרים אותם בקול.",
  },
  {
    section: "audience",
    title: "למי אנחנו מדברים",
    body: "זוגות מאורסים שבתחילת תכנון החתונה או עמוק בתוכו. התגובה שאנחנו רוצים: \"חחח אנחנו\" או \"תקשיב זה אנחנו\". תוכן שרוצים לשלוח לבן הזוג או לחברה.",
  },
  {
    section: "product",
    title: "מה זה",
    body: "משחק לזוגות מאורסים, לערב שבו עוצרים את התכנון ומדברים. שולפים קלף, קוראים, מדברים. אין ניקוד ואין תשובה נכונה. הכי מתאים בתחילת התכנון, לפני שכל ההחלטות כבר התקבלו.",
  },
  {
    section: "product_facts",
    title: "גודל הקופסה",
    body: "הקופסה בערך 12 על 8 ס״מ. כשהיא מופיעה בצילום, היא קטנה בפריים ובפרופורציות אמיתיות. לא מגדילים אותה ולא שמים אותה במרכז בכל צילום.",
  },
  {
    section: "founder_story",
    title: "ברק",
    body: "ברק הוא מפיק חתונות שעבד שנים קרוב לזוגות בזמן תכנון החתונה. הוא שם לב שזוגות מתחילים לתכנן אולמות, רשימות מוזמנים, תקציבים, ספקים ומעורבות משפחתית לפני שהם מקיימים חלק מהשיחות שיושבות מתחת להחלטות האלה. Before I Do נולד מהשיחות שהוא פגש, השיחות שמגיעות לפעמים מאוחר מדי.",
  },
  {
    section: "personal_context",
    title: "עכשיו",
    body: "ברק משרת כרגע במילואים. הקופסאות הראשונות מגיעות מבית הדפוס בזמן שהוא לא נמצא. בת הזוג שלו לקחה על עצמה את ההפצה, השיווק, התוכן ואת הדרך של המשחק לידיים של זוגות. אפשר להזכיר את המילואים בטבעיות כשזה חלק מהסיפור, אף פעם לא ככלי מכירה.",
  },
  {
    section: "tone",
    title: "הקול",
    body: "עברית מדוברת. כמו חברה חכמה ששולחת לך משהו בוואטסאפ. טבעי, ספציפי, קצת מצחיק כשמתאים, מודע לעצמו. לא מלוטש בשביל להישמע מקצועי.",
    meta: { avoid: "מוטיבציוני, טיפולי, מטיף, רגשני מדי, שפה שיווקית, שפה זוגית כללית, קלישאות, משפטים שנשמעים כמו משרד פרסום." },
  },
  { section: "good_examples", body: "כשאמרתם שאתם רוצים חתונה קטנה ואז גילית שאצלו קטנה זה 350 איש" },
  { section: "good_examples", body: "אמא שלו רוצה להוסיף עוד 40 מוזמנים.\nאת לא מכירה אף אחד מהם." },
  { section: "good_examples", body: "אם אף אחד מהמשפחה שלכם לא היה מביע דעה על החתונה, מה הייתם עושים אחרת?" },
  { section: "good_examples", body: "טוב, אני קצת מתרגשת לכתוב את זה פה." },
  { section: "good_examples", body: "השבוע מגיעות הקופסאות הראשונות מבית הדפוס.\nוברק במילואים.\nתזמון מושלם כמובן 😅" },
  { section: "bad_examples", body: "הדרך לחתונה מתחילה בתקשורת טובה." },
  { section: "bad_examples", body: "צרו רגעים משמעותיים יחד." },
  { section: "bad_examples", body: "העמיקו את הקשר שלכם לפני היום הגדול." },
  { section: "bad_examples", body: "המשחק שכל זוג מאורס חייב." },
  { section: "bad_examples", body: "הגיע הזמן לקחת את הזוגיות שלכם לשלב הבא." },
  { section: "bad_examples", body: "כל חתונה מתחילה באהבה." },
  { section: "words_we_use", body: "תשלחי לו · שמרו לערב · מה אצלכם? · רגע ביניכם · אין תשובה נכונה, יש שיחה שכדאי לעשות" },
  {
    section: "words_we_avoid",
    body: "חייב · הזדמנות · מושלם · בלתי נשכח · משמעותי · להעמיק · הקשר שלכם · היום הגדול · תקשורת זוגית · קנו עכשיו · המתנה המושלמת",
  },
  {
    section: "recurring_topics",
    body: "רשימת מוזמנים · כמה זה \"חתונה קטנה\" · תקציב ואקסל · ההורים ומי מחליט · ספקים והצעות מחיר · מה חשוב לכל אחד · פשרות · כולם שואלים מתי התאריך",
  },
  {
    section: "visual_principles",
    title: "אותנטי לפני מעוצב",
    body: "מערבבים בכוונה: צילום טלפון אמיתי, טיפוגרפיה פשוטה, פתקים, צילומי מסך, עיצוב ממותג מינימלי, צילום מוצר, וידאו מהיד ופרטים קטנים לא מושלמים. החשבון מרגיש אחיד בלי שכל פוסט ייראה כמו אותה תבנית.",
    meta: {
      avoid: "תמונות חתונה גנריות, זוגות מסטוק, טבעות, שמפניה, פרחים והינומות בכל פוסט, אסתטיקה של חתונת יוקרה.",
    },
  },
  {
    section: "visual_principles",
    title: "איפה מצלמים",
    body: "שולחן במסעדה, מטבח, ספה, קפה, רכב, רחוב, חבילות על הרצפה, משלוח מבית הדפוס, צילומי מסך מהטלפון, שולחן תכנון מבולגן.",
  },
];

export type TemplateSeed = {
  family: TemplateFamily;
  name: string;
  formats: Array<"story" | "carousel">;
  bestUse: string;
  config: Record<string, unknown>;
};

export const TEMPLATE_SEED: TemplateSeed[] = [
  {
    family: "text_message",
    name: "מחשבה שנכתבה מהר",
    formats: ["story", "carousel"],
    bestUse: "משפט אחד מוכר. טקסט גדול, הרבה אוויר, כמעט בלי מיתוג.",
    config: { background: "paper", textSize: "xl", align: "start" },
  },
  {
    family: "real_photo",
    name: "תמונה אמיתית",
    formats: ["story", "carousel"],
    bestUse: "תמונה מהגלריה על כל המסך עם משפט קצר. בלי להסתיר פנים.",
    config: { textPosition: "bottom", scrim: "soft" },
  },
  {
    family: "notes",
    name: "פתק בטלפון",
    formats: ["story", "carousel"],
    bestUse: "רשימות ותצפיות. מרגיש כמו פתק שכתבנו לעצמנו.",
    config: { paper: "lined" },
  },
  {
    family: "conversation",
    name: "שתי נקודות מבט",
    formats: ["story", "carousel"],
    bestUse: "\"אני\" מול \"הוא\", או \"מה שאמרנו\" מול \"מה שהתכוונו\".",
    config: { leftLabel: "אני", rightLabel: "הוא" },
  },
  {
    family: "question",
    name: "שאלה אחת",
    formats: ["story"],
    bestUse: "שאלה אחת, הרבה מקום. לסקרים ולתיבות שאלה.",
    config: { background: "pen" },
  },
  {
    family: "product_in_life",
    name: "המשחק בחיים",
    formats: ["story", "carousel"],
    bestUse: "תמונה אמיתית שבה המשחק נמצא בטבעיות. לא צילום מוצר מרחף.",
    config: { textPosition: "top", scrim: "soft" },
  },
  {
    family: "carousel_editorial",
    name: "קרוסלה עריכתית",
    formats: ["carousel"],
    bestUse: "שקף פתיחה חזק, מחשבה אחת בכל שקף, שינויים קטנים בין השקפים.",
    config: { numbering: true },
  },
];

export const HIGHLIGHT_SEED = [
  { key: "start_here", title: "תתחילו פה", purpose: "להכיר את הרעיון בלי למכור מיד.", sort: 1 },
  { key: "talked_about_it", title: "דיברתם על זה?", purpose: "השאלות והשיחות הכי חזקות, כולל שאלות מהקהל.", sort: 2 },
  {
    key: "the_game",
    title: "המשחק",
    purpose: "למי שרוצה מידע על המוצר: מה זה, איך משחקים, למי זה מתאים, תמונות אמיתיות, תגובות, הזמנה, משלוח וקישור.",
    sort: 3,
  },
] as const;
