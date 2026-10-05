import { CONTENT_STATUSES, FILMED_FORMATS, type ContentFormat, type ContentStatus } from "./constants";

const FILM_ONLY: ReadonlySet<ContentStatus> = new Set(["ready_to_film", "filmed", "editing"]);

/** The pipeline a piece actually goes through. Graphics never need filming states. */
export function statusesForFormat(format: ContentFormat): ContentStatus[] {
  if (FILMED_FORMATS.has(format)) return [...CONTENT_STATUSES];
  return CONTENT_STATUSES.filter((s) => !FILM_ONLY.has(s));
}

/** The next step in the pipeline, or null when already published. */
export function nextStatus(format: ContentFormat, current: ContentStatus): ContentStatus | null {
  const pipeline = statusesForFormat(format);
  const index = pipeline.indexOf(current);
  if (index === -1) {
    // e.g. a graphic sitting in "filmed" after a format change: continue from the closest later step
    const globalIndex = CONTENT_STATUSES.indexOf(current);
    return pipeline.find((s) => CONTENT_STATUSES.indexOf(s) > globalIndex) ?? null;
  }
  return pipeline[index + 1] ?? null;
}

export type StatusPatch = {
  status: ContentStatus;
  published_at?: string | null;
};

/**
 * Status changes are never blocked (people mark things out of order in real life),
 * but publishing stamps the date and un-publishing clears it so content memory stays honest.
 */
export function statusChangePatch(
  current: { status: ContentStatus; published_at: string | null },
  next: ContentStatus,
  now: Date = new Date(),
): StatusPatch {
  if (next === "published") {
    return { status: next, published_at: current.status === "published" && current.published_at ? current.published_at : now.toISOString() };
  }
  if (current.status === "published") return { status: next, published_at: null };
  return { status: next };
}

export function isStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

/** Visual grouping for the calendar & cards. */
export function statusTone(status: ContentStatus): "draft" | "progress" | "ready" | "done" {
  switch (status) {
    case "idea":
    case "writing":
      return "draft";
    case "ready_to_film":
    case "filmed":
    case "editing":
      return "progress";
    case "ready":
    case "scheduled":
      return "ready";
    case "published":
      return "done";
  }
}
