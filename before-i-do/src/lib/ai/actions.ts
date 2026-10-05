"use server";

import type { FeedbackKind } from "@/lib/domain/constants";

export type RewriteResult = { ok: true; contentId: string } | { ok: false; error: string; needsProvider?: boolean };

/** Placeholder until the generation layer lands (Phase 5). */
export async function rewriteContent(_id: string, _kind: FeedbackKind): Promise<RewriteResult> {
  return { ok: false, error: "עוד לא חובר מנוע כתיבה.", needsProvider: true };
}
