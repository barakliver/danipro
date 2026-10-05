import { z } from "zod";

// Brand design tokens for exported graphics (editable in Settings).
// Separate from the app's own UI tokens: the studio can stay calm while the
// account's visual language evolves.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const designSettingsSchema = z.object({
  colors: z
    .object({
      paper: hex.default("#f2efe8"),
      ink: hex.default("#1c1c1c"),
      accent: hex.default("#2f45c6"),
      muted: hex.default("#7a766e"),
      note: hex.default("#fbf6df"),
      highlight: hex.default("#f3e37a"),
    })
    .prefault({}),
  fonts: z
    .object({
      display: z.enum(["Frank Ruhl Libre", "Heebo", "IBM Plex Sans Hebrew"]).default("Frank Ruhl Libre"),
      text: z.enum(["Heebo", "IBM Plex Sans Hebrew", "Frank Ruhl Libre"]).default("Heebo"),
    })
    .prefault({}),
  /** px at 1080 wide */
  textSizes: z
    .object({
      xl: z.number().min(40).max(160).default(92),
      lg: z.number().min(32).max(130).default(72),
      md: z.number().min(24).max(100).default(56),
      sm: z.number().min(18).max(70).default(36),
    })
    .prefault({}),
  spacing: z.number().min(40).max(200).default(96),
  radius: z.number().min(0).max(80).default(36),
  imageTreatment: z.enum(["natural", "warm", "soft", "mono"]).default("natural"),
  /** Instagram UI covers roughly the top 250px and bottom 340px of a Story */
  storySafe: z.object({ top: z.number().default(250), bottom: z.number().default(340), side: z.number().default(90) }).prefault({}),
  carouselSafe: z.object({ top: z.number().default(110), bottom: z.number().default(130), side: z.number().default(96) }).prefault({}),
  identifier: z.object({ show: z.boolean().default(true), text: z.string().default("Before I Do") }).prefault({}),
  logoPath: z.string().nullable().default(null),
});

export type DesignSettings = z.infer<typeof designSettingsSchema>;

export function parseDesignSettings(value: unknown): DesignSettings {
  const parsed = designSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : designSettingsSchema.parse({});
}

export const STORY_SIZE = { width: 1080, height: 1920 } as const;
export const CAROUSEL_SIZE = { width: 1080, height: 1350 } as const;
