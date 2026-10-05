export type Orientation = "portrait" | "landscape" | "square";

export function orientationOf(width: number, height: number): Orientation {
  const ratio = width / height;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

/** Which formats a photo naturally fits, from its shape. */
export function suitableFormats(width: number, height: number): string[] {
  const ratio = width / height;
  if (ratio <= 0.7) return ["story", "reel"];
  if (ratio <= 0.9) return ["carousel", "story"];
  if (ratio <= 1.1) return ["carousel", "post"];
  return ["post"];
}
