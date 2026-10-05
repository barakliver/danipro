"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FEEDBACK_LABEL, FILMED_FORMATS, FORMAT_LABEL, PILLARS, REWRITE_FEEDBACK, type ContentFormat, type FeedbackKind } from "@/lib/domain/constants";
import { generate, rewriteOption, saveGenerated } from "@/lib/ai/actions";
import type { GeneratedOption } from "@/lib/ai/service";
import type { RenderContext } from "@/lib/render/context";
import { documentsFor, planFrames } from "@/lib/render/plan";
import { canvasSize } from "@/lib/render/document";
import { CLIENT_FONT_CSS } from "@/lib/render/fonts";
import { scoreTone } from "@/lib/voice/score";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/field";
import { IconSparkle } from "@/components/ui/icons";
import { FramePreview } from "@/components/render/frame-preview";
import { PovCard } from "@/components/content/pov-card";

const FORMAT_CHOICES: ContentFormat[] = ["story", "story_sequence", "carousel", "pov_reel", "talking_reel", "post", "question", "poll"];
const PILLAR_NAME = new Map(PILLARS.map((p) => [p.key, p.name]));

export function CreateView({
  initialText,
  initialFormat,
  ideaId,
  audienceEntryId,
  providerAvailable,
  render,
}: {
  initialText: string;
  initialFormat: ContentFormat | null;
  ideaId: string | null;
  audienceEntryId: string | null;
  providerAvailable: boolean;
  render: RenderContext;
}) {
  const [text, setText] = useState(initialText);
  const [format, setFormat] = useState<ContentFormat | null>(initialFormat);
  const [options, setOptions] = useState<GeneratedOption[]>([]);
  const [pending, startTransition] = useTransition();
  const [lastCount, setLastCount] = useState<1 | 3>(1);

  const run = (count: 1 | 3) =>
    startTransition(async () => {
      setLastCount(count);
      const result = await generate({ text, format, count, audienceText: Boolean(audienceEntryId) });
      if (!result.ok) return void toast.error(result.error);
      setOptions(result.data.options);
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });

  return (
    <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:pt-10">
      <h1 className="sr-only">יצירת תוכן</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(1);
        }}
        className="rounded-card border border-rule bg-surface p-4 shadow-lift sm:p-6"
      >
        <label htmlFor="create-input" className="font-display text-2xl text-ink lg:text-3xl">
          מה קרה / על מה בא לך לדבר?
        </label>
        {audienceEntryId && <p className="mt-1 text-sm text-graphite">יוצאים ממשפט אמיתי של הקהל. פרטים מזהים לא נכנסים לתוכן.</p>}
        <Textarea
          id="create-input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(1);
          }}
          placeholder="אמא שלו רוצה להזמין עוד 40 אנשים שאנחנו לא מכירים"
          className="mt-4 border-0 bg-paper px-4 py-3 font-display text-xl leading-snug focus:ring-0"
        />
        <div className="no-scrollbar -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6" role="radiogroup" aria-label="פורמט">
          <Chip size="sm" role="radio" aria-checked={format === null} selected={format === null} onClick={() => setFormat(null)}>
            שהסטודיו יבחר
          </Chip>
          {FORMAT_CHOICES.map((f) => (
            <Chip key={f} size="sm" role="radio" aria-checked={format === f} selected={format === f} onClick={() => setFormat(f)}>
              {FORMAT_LABEL[f]}
            </Chip>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="lg" pending={pending && lastCount === 1} disabled={pending || text.trim().length < 2}>
            <IconSparkle size={18} />
            {providerAvailable ? "צור אחד" : "צור טיוטה"}
          </Button>
          {providerAvailable && (
            <Button type="button" size="lg" pending={pending && lastCount === 3} disabled={pending || text.trim().length < 2} onClick={() => run(3)}>
              צור 3 כיוונים
            </Button>
          )}
        </div>
        {!providerAvailable && (
          <p className="mt-4 rounded-field bg-highlight-soft px-4 py-3 text-sm text-ink">
            עוד לא מחובר מנוע כתיבה, אז הסטודיו בונה טיוטה במבנה הנכון לפורמט ואת הכתיבה עושים בעורך.{" "}
            <Link href="/settings#ai" className="font-medium underline">
              איך מחברים
            </Link>
          </p>
        )}
      </form>

      <section id="results" aria-live="polite" className="scroll-mt-4 pb-10">
        {pending && (
          <div className="mt-8 flex flex-col gap-3" aria-busy>
            <p className="text-sm text-graphite">{providerAvailable ? "כותבת. זה יכול לקחת חצי דקה…" : "מכינה טיוטה…"}</p>
            {Array.from({ length: lastCount }, (_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-card bg-paper-deep" />
            ))}
          </div>
        )}
        {!pending && options.length > 0 && (
          <div className="mt-8 flex flex-col gap-6">
            {options.map((option, i) => (
              <OptionCard
                key={`${option.generationId ?? "local"}-${i}`}
                option={option}
                render={render}
                ideaId={ideaId}
                audienceEntryId={audienceEntryId}
                onReplace={(next) => setOptions((all) => all.map((o, j) => (j === i ? next : o)))}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OptionCard({
  option,
  render,
  ideaId,
  audienceEntryId,
  onReplace,
}: {
  option: GeneratedOption;
  render: RenderContext;
  ideaId: string | null;
  audienceEntryId: string | null;
  onReplace: (option: GeneratedOption) => void;
}) {
  const router = useRouter();
  const [assetId, setAssetId] = useState<string | null>(option.source === "ai" ? (option.assets[0]?.id ?? null) : null);
  const [templateId, setTemplateId] = useState<string | null>(option.templateIds[0] ?? null);
  const [pending, startTransition] = useTransition();
  const { draft } = option;
  const filmed = FILMED_FORMATS.has(draft.format);

  const previewDraft = useMemo(() => {
    const body = { ...draft.body };
    if (assetId) {
      if (body.frames?.length) body.frames = body.frames.map((f, i) => (i === 0 ? { ...f, assetId, kind: f.kind === "text" ? ("photo" as const) : f.kind } : f));
      else if (body.slides?.length) body.slides = body.slides.map((s, i) => (i === 0 ? { ...s, assetId } : s));
    }
    return { ...draft, body, template_id: templateId };
  }, [draft, assetId, templateId]);

  const { frames, docs } = useMemo(() => {
    const f = planFrames(previewDraft, render.templates, render.settings, (id) => option.assetUrls[id]?.preview);
    return { frames: f, docs: documentsFor(f.slice(0, 4), CLIENT_FONT_CSS, false) };
  }, [previewDraft, render, option.assetUrls]);

  const save = (thisIsUs: boolean) =>
    startTransition(async () => {
      const result = await saveGenerated({
        generationId: option.generationId,
        draft: { ...draft, pillarKey: draft.pillarKey },
        templateId,
        assetId,
        ideaId,
        audienceEntryId,
        scheduledOn: null,
        thisIsUs,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(thisIsUs ? "נשמר. נזכור שזה אנחנו." : "נשמר כטיוטה");
      router.push(`/content/${result.data.id}`);
    });

  const rewrite = (kind: FeedbackKind) =>
    startTransition(async () => {
      const result = await rewriteOption(option, kind);
      if (!result.ok) return void toast(result.error);
      onReplace(result.data);
    });

  const tone = scoreTone(option.score.score);
  return (
    <article className={cn("overflow-hidden rounded-card border border-rule bg-surface", pending && "opacity-60")} aria-label={option.direction}>
      <header className="flex items-center gap-3 border-b border-rule px-4 py-3 sm:px-6">
        <h2 className="font-display text-lg">{option.direction}</h2>
        <Tag tone="pen">{FORMAT_LABEL[draft.format]}</Tag>
        {draft.pillarKey && PILLAR_NAME.get(draft.pillarKey) && <Tag>{PILLAR_NAME.get(draft.pillarKey)}</Tag>}
        <span
          className={cn(
            "ms-auto inline-flex h-8 min-w-8 items-center justify-center rounded-chip border px-2 font-display tabular-nums",
            tone === "strong" ? "border-status-done/30 text-status-done" : tone === "ok" ? "border-status-progress/30 text-status-progress" : "border-danger/30 text-danger",
          )}
          title="נשמע כמו אנחנו"
          aria-label={`נשמע כמו אנחנו: ${option.score.score}`}
        >
          {option.score.score}
        </span>
      </header>

      <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          {draft.hook && !draft.body.slides?.length && <p className="font-display text-2xl leading-snug">{draft.hook}</p>}
          {draft.body.frames && draft.body.frames.length > 0 && (
            <ol className="mt-3 flex flex-col gap-2">
              {draft.body.frames.map((f, i) => (
                <li key={f.id} className="flex gap-3">
                  <span className="mt-1 w-5 shrink-0 text-xs text-mist">{i + 1}</span>
                  <div>
                    <p className="whitespace-pre-line text-[16px] leading-relaxed">{f.text}</p>
                    {f.options?.length ? <p className="mt-0.5 text-sm text-graphite">{f.options.filter(Boolean).join(" / ")}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {draft.body.slides && (
            <ol className="flex flex-col gap-1.5">
              {draft.body.slides.map((s, i) => (
                <li key={s.id} className={cn("flex gap-3", i === 0 && "font-display text-xl")}>
                  <span className="mt-1 w-5 shrink-0 text-xs text-mist">{i + 1}</span>
                  {s.text}
                </li>
              ))}
            </ol>
          )}
          {filmed && draft.body.pov && (
            <dl className="mt-3 grid gap-2 text-[15px]">
              <div>
                <dt className="text-xs text-graphite">מה עושים בפריים</dt>
                <dd className="whitespace-pre-line">{draft.body.pov.action}</dd>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {draft.body.pov.length && <Tag>{draft.body.pov.length}</Tag>}
                {draft.body.pov.location && <Tag>{draft.body.pov.location}</Tag>}
                {draft.body.pov.props.map((p) => (
                  <Tag key={p} tone="muted">
                    {p}
                  </Tag>
                ))}
              </div>
            </dl>
          )}
          <dl className="mt-5 grid gap-3 text-[15px]">
            {draft.caption && (
              <div>
                <dt className="text-xs text-graphite">כיתוב</dt>
                <dd>{draft.caption}</dd>
              </div>
            )}
            {draft.cta && (
              <div>
                <dt className="text-xs text-graphite">הנעה לפעולה</dt>
                <dd>{draft.cta}</dd>
              </div>
            )}
            {option.publishingContext && (
              <div>
                <dt className="text-xs text-graphite">מתי לפרסם</dt>
                <dd>{option.publishingContext}</dd>
              </div>
            )}
            {option.visualRecommendation && (
              <div>
                <dt className="text-xs text-graphite">ויזואל</dt>
                <dd>{option.visualRecommendation}</dd>
              </div>
            )}
          </dl>
          {option.score.flags.length > 0 && <p className="mt-4 text-sm text-status-progress">{option.score.flags[0].message} {option.score.flags[0].suggestion}</p>}
        </div>

        <div className="flex flex-col gap-3">
          {filmed ? (
            <div className="w-40">
              <PovCard pov={draft.body.pov} hook={draft.hook} />
            </div>
          ) : docs[0] ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
              {docs.slice(0, 1).map((html, i) => (
                <div key={i} className="w-40 shrink-0 md:w-full">
                  <FramePreview html={html} size={canvasSize(frames[0].input.format)} label={frames[i].label} />
                </div>
              ))}
            </div>
          ) : null}
          {!filmed && option.templateIds.length > 1 && (
            <div role="radiogroup" aria-label="תבנית" className="flex flex-wrap gap-1">
              {option.templateIds.map((id) => (
                <Chip key={id} size="sm" role="radio" aria-checked={templateId === id} selected={templateId === id} onClick={() => setTemplateId(id)}>
                  {render.templates.find((t) => t.id === id)?.name ?? "תבנית"}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      {option.assets.length > 0 && (
        <div className="border-t border-rule px-4 py-3 sm:px-6">
          <p className="mb-2 text-xs text-graphite">תמונות אמיתיות מהגלריה שמתאימות</p>
          <ul className="flex gap-2" role="radiogroup" aria-label="תמונה">
            {option.assets.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={assetId === a.id}
                  onClick={() => setAssetId(assetId === a.id ? null : a.id)}
                  className={cn("relative block h-20 w-16 overflow-hidden rounded-[10px] ring-offset-2", assetId === a.id ? "ring-2 ring-ink" : "opacity-80")}
                  title={a.why}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private media route */}
                  {option.assetUrls[a.id]?.thumb && <img src={option.assetUrls[a.id]!.thumb!} alt="" className="h-full w-full object-cover" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-3 sm:px-6">
        <Button variant="primary" disabled={pending} onClick={() => save(true)}>
          {FEEDBACK_LABEL.this_is_us}
        </Button>
        <Button disabled={pending} onClick={() => save(false)}>
          לשמור ולערוך
        </Button>
        <span className="mx-1 hidden h-6 w-px bg-rule sm:block" aria-hidden />
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {[...REWRITE_FEEDBACK.filter((k) => k !== "more_natural"), "other_direction" as const].map((kind) => (
            <button key={kind} type="button" disabled={pending} onClick={() => rewrite(kind)} className="h-9 shrink-0 rounded-chip px-3 text-sm text-ink-soft hover:bg-paper-deep disabled:opacity-50">
              {kind === "other_direction" ? "נסה כיוון אחר" : FEEDBACK_LABEL[kind]}
            </button>
          ))}
        </div>
      </footer>
    </article>
  );
}
