import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { FILMED_FORMATS, type ContentFormat, type FeedbackKind } from "@/lib/domain/constants";
import { collectCopy, newId, normalizeSlideRoles, type ContentBody, type StoryFrame } from "@/lib/domain/content-body";
import { detectTopics } from "@/lib/domain/topics";
import { scoreVoice, type VoiceScore } from "@/lib/voice/score";
import { loadAvoidList } from "@/lib/voice/brand-words";
import { listGallery } from "@/lib/gallery/queries";
import { signAssetUrls, type AssetUrls } from "@/lib/gallery/urls";
import { recommendAssets, TOPIC_TO_TAGS } from "@/lib/recommend/assets";
import { recommendTemplates } from "@/lib/render/recommend";
import { addDays, todayISO } from "@/lib/utils/dates";
import { getTextProvider, ProviderRefusal, type TextProvider } from "./provider";
import { SYSTEM_PROMPT } from "./prompts/system";
import { buildBrandContext } from "./prompts/context";
import { generationTask, rewriteTask } from "./prompts/tasks";
import { generationResultSchema, type GeneratedPiece } from "./schemas";

export type DraftFields = {
  format: ContentFormat;
  topic: string | null;
  hook: string | null;
  body: ContentBody;
  caption: string | null;
  cta: string | null;
  supporting_story: string | null;
  visual_notes: string | null;
  product_presence: "none" | "natural" | "direct";
  pillarKey: string | null;
  templateFamily: string | null;
};

export type GeneratedOption = {
  generationId: string | null;
  direction: string;
  draft: DraftFields;
  score: VoiceScore;
  publishingContext: string | null;
  visualRecommendation: string | null;
  assets: Array<{ id: string; why: string }>;
  assetUrls: AssetUrls;
  templateIds: string[];
  source: "ai" | "local";
};

/** Model output → our structure. Ids and roles are assigned here, never by the model. */
export function pieceToDraft(piece: GeneratedPiece): DraftFields {
  const body: ContentBody = {};
  if (piece.format === "carousel") {
    body.slides = normalizeSlideRoles(piece.slides.filter(Boolean).map((text) => ({ id: newId(), role: "body" as const, text })));
  } else if (FILMED_FORMATS.has(piece.format)) {
    if (piece.pov) body.pov = { ...piece.pov, sound: piece.pov.sound || undefined };
  } else {
    body.frames = piece.frames
      .filter((f) => f.text.trim())
      .slice(0, 5)
      .map((f): StoryFrame => ({ id: newId(), kind: f.kind, text: f.text, options: f.kind === "poll" ? f.options.slice(0, 4) : undefined }));
  }
  return {
    format: piece.format,
    topic: piece.topic || null,
    hook: piece.hook || null,
    body,
    caption: piece.caption || null,
    cta: piece.cta || null,
    supporting_story: piece.supportingStory || null,
    visual_notes: piece.visualRecommendation || null,
    product_presence: piece.productPresence,
    pillarKey: piece.pillarKey || null,
    templateFamily: piece.templateFamily,
  };
}

/**
 * Without a provider: an honest structural draft built from what was typed.
 * It does not pretend to write; it gives the right skeleton for the format.
 */
export function localDraft(text: string, format: ContentFormat): DraftFields {
  const clean = text.trim();
  const sentences = clean.split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const body: ContentBody = {};
  if (format === "carousel") {
    body.slides = normalizeSlideRoles([clean, "", "", ""].map((t, i) => ({ id: newId(), role: "body" as const, text: i === 0 ? t : "" })));
  } else if (FILMED_FORMATS.has(format)) {
    body.pov = { onScreenText: clean.startsWith("POV") || clean.startsWith("כש") ? clean : `POV: ${clean}`, shot: "", action: "", length: "5 עד 8 שניות", location: "", props: [], gameAppears: false };
  } else if (format === "poll") {
    body.frames = [{ id: newId(), kind: "poll", text: clean, options: ["", ""] }];
  } else if (format === "question") {
    body.frames = [{ id: newId(), kind: "question", text: clean }];
  } else {
    body.frames = (sentences.length ? sentences : [clean]).slice(0, 4).map((s) => ({ id: newId(), kind: "text" as const, text: s }));
    if (format === "story_sequence") body.frames.push({ id: newId(), kind: "question", text: "ומה אצלכם?" });
  }
  return {
    format,
    topic: null,
    hook: FILMED_FORMATS.has(format) ? (body.pov?.onScreenText ?? clean) : clean,
    body,
    caption: null,
    cta: null,
    supporting_story: null,
    visual_notes: null,
    product_presence: /המשחק|קלפים|קופס|Before I Do/.test(clean) ? "natural" : "none",
    pillarKey: null,
    templateFamily: null,
  };
}

function copyOf(draft: DraftFields) {
  return collectCopy({ hook: draft.hook, caption: draft.caption, cta: draft.cta, body: draft.body });
}

async function recordHistory(
  studio: Studio,
  row: { task: string; provider: string; model: string | null; input: unknown; context_summary: unknown; output: unknown; score: number | null; status: "ok" | "error" | "fallback"; error?: string; latency_ms?: number; content_id?: string | null },
): Promise<string | null> {
  const { data } = await studio.supabase
    .from("generation_history")
    .insert({
      workspace_id: studio.workspace.id,
      task: row.task,
      provider: row.provider,
      model: row.model,
      input: row.input as never,
      context_summary: row.context_summary as never,
      output: row.output as never,
      score: row.score,
      status: row.status,
      error: row.error ?? null,
      latency_ms: row.latency_ms ?? null,
      content_id: row.content_id ?? null,
      created_by: studio.userId,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

/** Real Gallery photos and 2-3 templates for each option. */
export async function attachRecommendations(studio: Studio, drafts: DraftFields[], assetTagsPerDraft: string[][]) {
  const [gallery, templates, recentAssets] = await Promise.all([
    listGallery(studio),
    studio.supabase.from("templates").select("id, family, name, formats, is_favorite, usage_count, last_used_at").eq("workspace_id", studio.workspace.id).is("archived_at", null).then((r) => r.data ?? []),
    studio.supabase
      .from("content_assets")
      .select("asset_id, created_at")
      .eq("workspace_id", studio.workspace.id)
      .gte("created_at", addDays(todayISO(), -14))
      .then((r) => (r.data ?? []).map((x) => x.asset_id)),
  ]);
  const recentTemplates = await studio.supabase
    .from("content_items")
    .select("template_id")
    .eq("workspace_id", studio.workspace.id)
    .not("template_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(8)
    .then((r) => (r.data ?? []).map((x) => x.template_id as string));

  const results = drafts.map((draft, i) => {
    const topics = detectTopics(draft.topic, ...copyOf(draft));
    const tags = assetTagsPerDraft[i]?.length ? assetTagsPerDraft[i] : topics.flatMap((t) => TOPIC_TO_TAGS[t] ?? []);
    const assets = recommendAssets(gallery, { tags, format: draft.format, productPresence: draft.product_presence, recentlyUsed: recentAssets }, 4);
    const templateRecs = recommendTemplates(templates, { format: draft.format, body: draft.body, productPresence: draft.product_presence, recentTemplateIds: recentTemplates });
    // the model's own template pick goes first when it is one of ours
    const preferred = templates.find((t) => t.family === draft.templateFamily && t.formats.includes(draft.format === "carousel" ? "carousel" : "story"));
    const templateIds = Array.from(new Set([preferred?.id, ...templateRecs.map((r) => r.templateId)].filter((x): x is string => Boolean(x)))).slice(0, 3);
    return { assets: assets.map((a) => ({ id: a.asset.id, why: a.why })), templateIds };
  });
  const urls = await signAssetUrls(studio, results.flatMap((r) => r.assets.map((a) => a.id)));
  return results.map((r) => ({ ...r, assetUrls: Object.fromEntries(r.assets.map((a) => [a.id, urls[a.id]])) as AssetUrls }));
}

const WEAK = 55;

async function generateWithProvider(provider: TextProvider, studio: Studio, task: string, contextText: string) {
  return provider.generate({ system: SYSTEM_PROMPT, context: contextText, task, schema: generationResultSchema, effort: "medium", maxTokens: 12000 });
}

export async function generateOptions(
  studio: Studio,
  input: { text: string; format: ContentFormat | null; count: 1 | 3; audienceText?: boolean; pillarHint?: string | null },
): Promise<{ options: GeneratedOption[]; providerAvailable: boolean }> {
  const provider = getTextProvider();
  const avoid = await loadAvoidList(studio);

  if (!provider) {
    const format = input.format ?? "story_sequence";
    const draft = localDraft(input.text, format);
    const score = scoreVoice(copyOf(draft), { avoid, productIntent: draft.product_presence });
    const generationId = await recordHistory(studio, { task: "directions", provider: "local", model: null, input, context_summary: {}, output: draft, score: score.score, status: "fallback" });
    const [rec] = await attachRecommendations(studio, [draft], [[]]);
    return {
      providerAvailable: false,
      options: [{ generationId, direction: "טיוטה לפי הפורמט", draft, score, publishingContext: null, visualRecommendation: null, ...rec, source: "local" }],
    };
  }

  const context = await buildBrandContext(studio, input.text);
  const task = generationTask({ text: input.text, format: input.format, count: input.count, pillarHint: input.pillarHint, fromAudience: input.audienceText });
  try {
    const result = await generateWithProvider(provider, studio, task, context.text);
    let pieces = result.output.pieces.slice(0, input.count);

    // Content quality rule: anything that still sounds like marketing gets one rewrite pass.
    pieces = await Promise.all(
      pieces.map(async (piece) => {
        const draft = pieceToDraft(piece);
        const score = scoreVoice(copyOf(draft), { avoid, productIntent: draft.product_presence });
        if (score.score >= WEAK) return piece;
        try {
          const retry = await provider.generate({
            system: SYSTEM_PROMPT,
            context: context.text,
            task: rewriteTask(copyOf(draft).join("\n"), "less_promotional", piece.format) + `\nבעיות שזוהו: ${score.flags.map((f) => f.message).join(" ")}`,
            schema: generationResultSchema,
            effort: "medium",
          });
          const better = retry.output.pieces[0];
          if (!better) return piece;
          const betterScore = scoreVoice(copyOf(pieceToDraft(better)), { avoid, productIntent: better.productPresence });
          return betterScore.score > score.score ? { ...better, direction: piece.direction } : piece;
        } catch {
          return piece;
        }
      }),
    );

    const drafts = pieces.map(pieceToDraft);
    const recs = await attachRecommendations(studio, drafts, pieces.map((p) => p.assetTags));
    const options: GeneratedOption[] = [];
    for (const [i, piece] of pieces.entries()) {
      const draft = drafts[i];
      const score = scoreVoice(copyOf(draft), { avoid, productIntent: draft.product_presence });
      const generationId = await recordHistory(studio, {
        task: input.count === 3 ? "directions" : draft.format === "carousel" ? "carousel" : FILMED_FORMATS.has(draft.format) ? "pov" : draft.format === "post" ? "post" : "story_sequence",
        provider: provider.id,
        model: result.model,
        input,
        context_summary: context.summary,
        output: piece,
        score: score.score,
        status: "ok",
        latency_ms: result.latencyMs,
      });
      options.push({
        generationId,
        direction: piece.direction,
        draft,
        score,
        publishingContext: piece.publishingContext || null,
        visualRecommendation: piece.visualRecommendation || null,
        ...recs[i],
        source: "ai",
      });
    }
    return { options, providerAvailable: true };
  } catch (error) {
    await recordHistory(studio, { task: "directions", provider: provider.id, model: provider.model, input, context_summary: context.summary, output: null, score: null, status: "error", error: error instanceof Error ? error.message : String(error) });
    if (error instanceof ProviderRefusal) throw error;
    throw new Error("הכתיבה נכשלה. אפשר לנסות שוב בעוד רגע.");
  }
}

/** Rewrite an existing piece according to feedback; returns the new fields (not yet saved). */
export async function rewriteDraft(studio: Studio, current: DraftFields & { id: string | null }, kind: FeedbackKind): Promise<{ draft: DraftFields; generationId: string | null; score: VoiceScore } | null> {
  const provider = getTextProvider();
  if (!provider) return null;
  const copy = copyOf(current).join("\n");
  const context = await buildBrandContext(studio, copy);
  const result = await provider.generate({ system: SYSTEM_PROMPT, context: context.text, task: rewriteTask(copy, kind, current.format), schema: generationResultSchema, effort: "medium" });
  const piece = result.output.pieces[0];
  if (!piece) throw new Error("לא התקבלה גרסה חדשה");
  const draft = pieceToDraft({ ...piece, format: current.format });
  const score = scoreVoice(copyOf(draft), { avoid: await loadAvoidList(studio), productIntent: draft.product_presence });
  const generationId = await recordHistory(studio, {
    task: "rewrite",
    provider: provider.id,
    model: result.model,
    input: { kind, contentId: current.id },
    context_summary: context.summary,
    output: piece,
    score: score.score,
    status: "ok",
    latency_ms: result.latencyMs,
    content_id: current.id,
  });
  return { draft, generationId, score };
}
