// Product vocabulary. Hebrew labels live here so the UI, importer, and generator agree.

export const CONTENT_FORMATS = [
  "story",
  "story_sequence",
  "carousel",
  "pov_reel",
  "talking_reel",
  "reel",
  "post",
  "question",
  "poll",
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  story: "סטורי",
  story_sequence: "רצף סטוריז",
  carousel: "קרוסלה",
  pov_reel: "ריל POV",
  talking_reel: "ריל דיבור",
  reel: "ריל",
  post: "פוסט",
  question: "שאלה",
  poll: "סקר",
};

/** Formats that are rendered as graphics by the template engine. */
export const RENDERABLE_FORMATS: ReadonlySet<ContentFormat> = new Set([
  "story",
  "story_sequence",
  "carousel",
  "question",
  "poll",
  "post",
]);

/** Formats that need someone in front of a camera. */
export const FILMED_FORMATS: ReadonlySet<ContentFormat> = new Set(["pov_reel", "talking_reel", "reel"]);

export const CONTENT_STATUSES = [
  "idea",
  "writing",
  "ready_to_film",
  "filmed",
  "editing",
  "ready",
  "scheduled",
  "published",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "רעיון",
  writing: "בכתיבה",
  ready_to_film: "מוכן לצילום",
  filmed: "צולם",
  editing: "בעריכה",
  ready: "מוכן",
  scheduled: "מתוזמן",
  published: "פורסם",
};

export type RatioGroup = "audience" | "natural_product" | "direct_product";

export type PillarSeed = {
  key: string;
  name: string;
  description: string;
  ratio_group: RatioGroup;
};

export const PILLARS: readonly PillarSeed[] = [
  {
    key: "talk_about_it",
    name: "רגע, דיברתם על זה?",
    description: "שיחות שזוגות לא חושבים עליהן עד שתכנון החתונה מכריח אותם.",
    ratio_group: "audience",
  },
  {
    key: "so_us",
    name: "חחח אנחנו",
    description: "סיטואציות מוכרות מאוד. המקור המרכזי ל-POV ולפוסטים שמשתפים.",
    ratio_group: "audience",
  },
  {
    key: "nobody_told_us",
    name: "אף אחד לא סיפר לנו",
    description: "דברים שמגלים תוך כדי תכנון: כסף, משפחות, אורחים, סדרי עדיפויות, פשרות, ציפיות.",
    ratio_group: "audience",
  },
  {
    key: "whose_side",
    name: "של מי הצד?",
    description: "דילמות אמיתיות שבהן העוקבים בוחרים צד.",
    ratio_group: "audience",
  },
  {
    key: "in_life",
    name: "Before I Do בחיים עצמם",
    description: "המשחק מופיע בטבעיות: בבית, במסעדה, בדייט, בקפה, בטיול. לא כל הופעה היא צילום מוצר.",
    ratio_group: "natural_product",
  },
  {
    key: "behind_scenes",
    name: "מאחורי הקלעים",
    description: "דפוס, קופסאות, אריזה, משלוחים, טעויות, ניצחונות קטנים, ניהול העסק.",
    ratio_group: "natural_product",
  },
  {
    key: "you_said",
    name: "אתם אמרתם",
    description: "תגובות אנונימיות וסיטואציות אמיתיות שזוגות מאורסים שלחו.",
    ratio_group: "audience",
  },
  {
    key: "the_game",
    name: "המשחק",
    description: "תוכן מוצר ישיר: מה זה, איך משחקים, למי זה מתאים. בעיקר בהיילייט ובתוכן מוצר רלוונטי.",
    ratio_group: "direct_product",
  },
];

export const RATIO_TARGET: Record<RatioGroup, number> = {
  audience: 0.7,
  natural_product: 0.2,
  direct_product: 0.1,
};

export const RATIO_LABEL: Record<RatioGroup, string> = {
  audience: "החיים של הקהל",
  natural_product: "המשחק בטבעיות",
  direct_product: "מוצר ישיר",
};

export const FEEDBACK_KINDS = [
  "more_personal",
  "less_promotional",
  "funnier",
  "sharper",
  "more_natural",
  "this_is_us",
  "not_us",
  "other_direction",
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  more_personal: "יותר אישי",
  less_promotional: "פחות פרסומי",
  funnier: "יותר מצחיק",
  sharper: "יותר חד",
  more_natural: "יותר טבעי",
  this_is_us: "זה אנחנו",
  not_us: "לא אנחנו",
  other_direction: "נסה כיוון אחר",
};

/** Feedback that asks for a rewrite (vs. a verdict). */
export const REWRITE_FEEDBACK: readonly FeedbackKind[] = [
  "more_personal",
  "less_promotional",
  "funnier",
  "sharper",
  "more_natural",
];

export const IDEA_TAGS = [
  "כסף",
  "הורים",
  "רשימת מוזמנים",
  "אולם",
  "תקציב",
  "גודל החתונה",
  "ספקים",
  "ציפיות",
  "ויכוחים",
  "מצחיק",
  "אישי",
  "מאחורי הקלעים",
  "מוצר",
  "הודעה מלקוח",
] as const;

export const GALLERY_TAG_SEEDS: ReadonlyArray<{ name: string; kind: "people" | "place" | "subject" | "format" | "mood" }> = [
  { name: "אני", kind: "people" },
  { name: "ברק", kind: "people" },
  { name: "אנחנו", kind: "people" },
  { name: "זוג", kind: "people" },
  { name: "מוצר", kind: "subject" },
  { name: "קופסה", kind: "subject" },
  { name: "קלפים", kind: "subject" },
  { name: "בית", kind: "place" },
  { name: "מסעדה", kind: "place" },
  { name: "קפה", kind: "place" },
  { name: "ערב", kind: "mood" },
  { name: "רחוב", kind: "place" },
  { name: "תל אביב", kind: "place" },
  { name: "מאחורי הקלעים", kind: "subject" },
  { name: "בית דפוס", kind: "place" },
  { name: "משלוחים", kind: "subject" },
  { name: "אריזה", kind: "subject" },
  { name: "לא מבוים", kind: "mood" },
  { name: "קלוז אפ", kind: "format" },
  { name: "סטורי", kind: "format" },
  { name: "קרוסלה", kind: "format" },
  { name: "ריל", kind: "format" },
  { name: "רקע", kind: "format" },
];

export const LOCATION_CATEGORIES = ["בית", "מסעדה", "קפה", "רחוב", "רכב", "משרד", "בחוץ", "בית דפוס"] as const;

export const AUDIENCE_SOURCE_TYPES = [
  "story_reply",
  "dm",
  "comment",
  "question",
  "situation",
  "quote",
  "objection",
] as const;
export type AudienceSourceType = (typeof AUDIENCE_SOURCE_TYPES)[number];
export const AUDIENCE_SOURCE_LABEL: Record<AudienceSourceType, string> = {
  story_reply: "תגובה לסטורי",
  dm: "הודעה פרטית",
  comment: "תגובה",
  question: "שאלה",
  situation: "סיטואציה",
  quote: "ציטוט",
  objection: "התנגדות",
};

export const PERMISSION_LABEL: Record<string, string> = {
  not_needed: "לא צריך אישור",
  pending: "ממתין לאישור",
  granted: "אושר",
  denied: "לא אושר",
};

/** Batch filming: what can be available on a filming day. */
export const FILMING_RESOURCES = [
  { key: "me", label: "אני" },
  { key: "barak", label: "ברק" },
  { key: "couple", label: "זוג" },
  { key: "product", label: "המשחק" },
  { key: "home", label: "בית" },
  { key: "restaurant", label: "מסעדה" },
  { key: "outside", label: "בחוץ" },
  { key: "car", label: "רכב" },
  { key: "office", label: "משרד" },
] as const;
export type FilmingResource = (typeof FILMING_RESOURCES)[number]["key"];

export const FILMING_DURATIONS = [15, 30, 45, 60, 90] as const;
