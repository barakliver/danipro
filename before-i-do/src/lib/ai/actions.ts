"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { CONTENT_FORMATS, FEEDBACK_KINDS, type FeedbackKind } from "@/lib/domain/constants";
import { collectCopy, contentBodySchema, parseContentBody } from "@/lib/domain/content-body";
import { detectTopics } from "@/lib/domain/topics";
import { scoreVoice } from "@/lib/voice/score";
import { snapshotOf } from "@/lib/content/snapshot";
import { ProviderRefusal } from "./provider";
import { scrubPII } from "@/lib/audience/privacy";
import { attachRecommendations, generateOptions, rewriteDraft, type DraftFields, type GeneratedOption } from "./service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; needsProvider?: boolean };

const generateSchema = z.object({
  text: z.string().trim().min(2, "כתבי משהו קצר: מה קרה או על מה בא לך לדבר").max(3000),
  format: z.enum(CONTENT_FORMATS).nullable(),
  count: z.union([z.literal(1), z.literal(3)]),
  audienceText: z.boolean().optional(),
});

export async function generate(input: z.input<typeof generateSchema>): Promise<Result<{ options: GeneratedOption[]; providerAvailable: boolean }>> {
  try {
    const clean = generateSchema.parse(input);
    // audience lines never carry identifying details into generated content
    if (clean.audienceText) clean.text = scrubPII(clean.text);
    const data = await generateOptions(await getStudio(), clean);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "בדקי את הקלט" };
    return { ok: false, error: error instanceof Error ? error.message : "משהו השתבש" };
  }
}

const saveSchema = z.object({
  generationId: z.uuid().nullable(),
  draft: z.object({
    format: z.enum(CONTENT_FORMATS),
    topic: z.string().max(300).nullable(),
    hook: z.string().max(5000).nullable(),
    body: contentBodySchema,
    caption: z.string().max(5000).nullable(),
    cta: z.string().max(500).nullable(),
    supporting_story: z.string().max(5000).nullable(),
    visual_notes: z.string().max(5000).nullable(),
    product_presence: z.enum(["none", "natural", "direct"]),
    pillarKey: z.string().max(60).nullable(),
  }),
  templateId: z.uuid().nullable(),
  assetId: z.uuid().nullable(),
  ideaId: z.uuid().nullable(),
  audienceEntryId: z.uuid().nullable(),
  scheduledOn: z.iso.date().nullable(),
  thisIsUs: z.boolean(),
});

/** Turns a generated option into real, editable content. */
export async function saveGenerated(input: z.input<typeof saveSchema>): Promise<Result<{ id: string }>> {
  try {
    const clean = saveSchema.parse(input);
    const studio = await getStudio();
    const { supabase, workspace, userId } = studio;
    const { draft } = clean;

    let pillarId: string | null = null;
    if (draft.pillarKey) {
      const { data } = await supabase.from("content_pillars").select("id").eq("workspace_id", workspace.id).eq("key", draft.pillarKey).maybeSingle();
      pillarId = data?.id ?? null;
    }
    // put the chosen photo on the first frame/slide that can hold one
    const body = { ...draft.body };
    if (clean.assetId) {
      if (body.frames?.length) body.frames = body.frames.map((f, i) => (i === 0 ? { ...f, assetId: clean.assetId!, kind: f.kind === "text" ? "photo" : f.kind } : f));
      else if (body.slides?.length) body.slides = body.slides.map((s, i) => (i === 0 ? { ...s, assetId: clean.assetId! } : s));
    }
    const copy = collectCopy({ hook: draft.hook, caption: draft.caption, cta: draft.cta, body });
    const voice = scoreVoice(copy, { productIntent: draft.product_presence });
    const filmed = ["pov_reel", "talking_reel", "reel"].includes(draft.format);

    const { data, error } = await supabase
      .from("content_items")
      .insert({
        workspace_id: workspace.id,
        format: draft.format,
        pillar_id: pillarId,
        status: filmed ? "ready_to_film" : "ready",
        topic: draft.topic,
        hook: draft.hook,
        body: body as never,
        caption: draft.caption,
        cta: draft.cta,
        supporting_story: draft.supporting_story,
        visual_notes: draft.visual_notes,
        product_presence: draft.product_presence,
        requires_filming: filmed,
        requires_product: draft.product_presence !== "none",
        template_id: clean.templateId,
        idea_id: clean.ideaId,
        audience_entry_id: clean.audienceEntryId,
        sounds_like_us: voice.score,
        score_breakdown: { source: voice.source, dimensions: voice.dimensions, flags: voice.flags.map((f) => f.code) } as never,
        topic_tags: detectTopics(draft.topic, ...copy),
        source: clean.audienceEntryId ? "audience" : clean.ideaId ? "idea" : "generated",
        source_ref: clean.generationId ? `gen:${clean.generationId}` : null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("content_versions").insert({ workspace_id: workspace.id, content_id: data.id, snapshot: snapshotOf({ ...draft, body, pillar_id: pillarId, template_id: clean.templateId } as never) as never, reason: "generation", created_by: userId });
    if (clean.generationId) await supabase.from("generation_history").update({ content_id: data.id }).eq("id", clean.generationId).eq("workspace_id", workspace.id);
    if (clean.scheduledOn) await supabase.from("content_calendar").insert({ workspace_id: workspace.id, content_id: data.id, scheduled_on: clean.scheduledOn });
    if (clean.ideaId) await supabase.from("ideas").update({ status: "developed" }).eq("workspace_id", workspace.id).eq("id", clean.ideaId);
    if (clean.thisIsUs) {
      await supabase.from("content_feedback").insert({ workspace_id: workspace.id, content_id: data.id, generation_id: clean.generationId, kind: "this_is_us", text_snapshot: copy.join("\n"), created_by: userId });
    }
    if (clean.assetId) {
      const role = body.frames?.[0]?.id ?? body.slides?.[0]?.id ?? "primary";
      await supabase.from("content_assets").insert({ workspace_id: workspace.id, content_id: data.id, asset_id: clean.assetId, role });
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "השמירה נכשלה" };
  }
}

export type RewriteResult = { ok: true; contentId: string } | { ok: false; error: string; needsProvider?: boolean };

/** "יותר אישי" / "פחות פרסומי" / ... on saved content. The previous text is kept as a version. */
export async function rewriteContent(id: string, kind: FeedbackKind): Promise<RewriteResult> {
  try {
    z.uuid().parse(id);
    z.enum(FEEDBACK_KINDS).parse(kind);
    const studio = await getStudio();
    const { supabase, workspace, userId } = studio;
    const { data: row, error } = await supabase.from("content_items").select("*").eq("workspace_id", workspace.id).eq("id", id).single();
    if (error) throw error;
    const current = {
      id,
      format: row.format as (typeof CONTENT_FORMATS)[number],
      topic: row.topic,
      hook: row.hook,
      body: parseContentBody(row.body),
      caption: row.caption,
      cta: row.cta,
      supporting_story: row.supporting_story,
      visual_notes: row.visual_notes,
      product_presence: row.product_presence as "none" | "natural" | "direct",
      pillarKey: null,
      templateFamily: null,
    };
    const result = await rewriteDraft(studio, current, kind);
    if (!result) return { ok: false, error: "עוד לא חובר מנוע כתיבה, אז אין גרסה חדשה.", needsProvider: true };

    await supabase.from("content_versions").insert({ workspace_id: workspace.id, content_id: id, snapshot: snapshotOf(row) as never, reason: "manual", created_by: userId });
    // keep photos the person already chose on the matching positions
    const next = result.draft;
    const oldFrames = current.body.frames ?? [];
    const oldSlides = current.body.slides ?? [];
    const body = {
      ...next.body,
      frames: next.body.frames?.map((f, i) => ({ ...f, assetId: oldFrames[i]?.assetId })),
      slides: next.body.slides?.map((s, i) => ({ ...s, assetId: oldSlides[i]?.assetId })),
    };
    const copy = collectCopy({ hook: next.hook, caption: next.caption ?? row.caption, cta: next.cta ?? row.cta, body });
    const voice = scoreVoice(copy, { productIntent: current.product_presence });
    const { error: updateError } = await supabase
      .from("content_items")
      .update({
        hook: next.hook ?? row.hook,
        body: body as never,
        caption: next.caption ?? row.caption,
        cta: next.cta ?? row.cta,
        sounds_like_us: voice.score,
        topic_tags: detectTopics(row.topic, ...copy),
      })
      .eq("workspace_id", workspace.id)
      .eq("id", id);
    if (updateError) throw updateError;
    await supabase.from("content_versions").insert({ workspace_id: workspace.id, content_id: id, snapshot: snapshotOf({ ...row, hook: next.hook, body, caption: next.caption, cta: next.cta } as never) as never, reason: "generation", created_by: userId });
    revalidatePath("/", "layout");
    return { ok: true, contentId: id };
  } catch (error) {
    if (error instanceof ProviderRefusal) return { ok: false, error: error.message };
    return { ok: false, error: error instanceof Error ? error.message : "משהו השתבש" };
  }
}

/** Status for the UI: is a writing engine configured? */
export async function providerStatus(): Promise<{ text: boolean; image: boolean }> {
  return { text: Boolean(process.env.ANTHROPIC_API_KEY?.trim()), image: false };
}

/** Rewrite one generated option (before it is saved) and remember the request as feedback. */
export async function rewriteOption(option: GeneratedOption, kind: FeedbackKind): Promise<Result<GeneratedOption>> {
  try {
    z.enum(FEEDBACK_KINDS).parse(kind);
    const studio = await getStudio();
    const draft = option.draft as DraftFields;
    await studio.supabase.from("content_feedback").insert({
      workspace_id: studio.workspace.id,
      generation_id: option.generationId,
      kind,
      text_snapshot: collectCopy({ hook: draft.hook, caption: draft.caption, cta: draft.cta, body: draft.body }).join("\n"),
      created_by: studio.userId,
    });
    const result = await rewriteDraft(studio, { ...draft, body: parseContentBody(draft.body), id: null }, kind);
    if (!result) return { ok: false, error: "עוד לא חובר מנוע כתיבה, אז אין גרסה חדשה. ההערה נשמרה.", needsProvider: true };
    const [rec] = await attachRecommendations(studio, [result.draft], [[]]);
    return {
      ok: true,
      data: { ...option, generationId: result.generationId, draft: result.draft, score: result.score, ...rec, assets: option.assets.length ? option.assets : rec.assets, assetUrls: { ...rec.assetUrls, ...option.assetUrls } },
    };
  } catch (error) {
    if (error instanceof ProviderRefusal) return { ok: false, error: error.message };
    return { ok: false, error: error instanceof Error ? error.message : "משהו השתבש" };
  }
}
