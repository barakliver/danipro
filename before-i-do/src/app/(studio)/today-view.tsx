"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import type { Content } from "@/lib/content/types";
import type { TodayPlan } from "@/lib/content/today";
import type { RenderContext } from "@/lib/render/context";
import { documentsFor, hasGraphics, planFrames } from "@/lib/render/plan";
import { canvasSize } from "@/lib/render/document";
import { CLIENT_FONT_CSS } from "@/lib/render/fonts";
import type { AssetUrls } from "@/lib/gallery/urls";
import { FEEDBACK_LABEL, FILMED_FORMATS, type FeedbackKind } from "@/lib/domain/constants";
import { rewriteContent } from "@/lib/ai/actions";
import { relativeDayLabel, formatDayShort } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { IconSparkle } from "@/components/ui/icons";
import { FramePreview } from "@/components/render/frame-preview";
import { CopyButton } from "@/components/content/copy-button";
import { FormatTag, NeedsList, PillarTag, StatusPill } from "@/components/content/meta";
import { StatusActions } from "@/components/content/status-actions";

type Props = {
  warnings: string[];
  dateLabel: string;
  today: string;
  plan: TodayPlan;
  upcoming: Content[];
  render: RenderContext;
  assetUrls: AssetUrls;
};

export function TodayView({ warnings, dateLabel, today, plan, upcoming, render, assetUrls }: Props) {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:pt-12">
      <header className="mb-6 lg:mb-10">
        <p className="text-sm text-graphite">{dateLabel}</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-ink lg:text-4xl">מה מעלים היום?</h1>
      </header>

      <MainPick plan={plan} render={render} assetUrls={assetUrls} warnings={warnings} />

      {plan.alsoToday.length > 0 && (
        <section className="mt-6" aria-labelledby="also-today">
          <h2 id="also-today" className="mb-2 text-sm font-medium text-graphite">
            עוד היום
          </h2>
          <ul className="flex flex-col gap-2">
            {plan.alsoToday.map((item) => (
              <CompactRow key={item.id} item={item} today={today} />
            ))}
          </ul>
        </section>
      )}

      {plan.quickStory && (
        <QuickStory item={plan.quickStory} render={render} assetUrls={assetUrls} />
      )}

      {upcoming.length > 0 && (
        <section className="mt-10" aria-labelledby="upcoming">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="upcoming" className="font-display text-xl text-ink">
              בימים הקרובים
            </h2>
            <Link href="/calendar" className="text-sm font-medium text-pen hover:underline">
              ללוח המלא
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {upcoming.map((item) => (
              <CompactRow key={item.id} item={item} today={today} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function MainPick({ plan, render, assetUrls, warnings }: { plan: TodayPlan; render: RenderContext; assetUrls: AssetUrls; warnings: string[] }) {
  const main = plan.main;
  if (main.kind === "idea") {
    return (
      <article className="rounded-card border border-rule bg-surface p-5 sm:p-7">
        <p className="text-sm text-graphite">אין משהו מתוכנן להיום, ואין משהו מוכן. יש רעיון שחיכה לך:</p>
        <p className="mt-3 font-display text-2xl leading-snug text-ink">
          <span className="highlighted">{main.text}</span>
        </p>
        <Button asChild variant="primary" size="lg" className="mt-6">
          <Link href={`/create?idea=${main.ideaId}`}>לפתח לתוכן</Link>
        </Button>
      </article>
    );
  }
  if (main.kind === "prompt") {
    return (
      <article className="rounded-card border border-rule bg-surface p-5 sm:p-7">
        <p className="text-sm text-graphite">היום ריק, וזה בסדר. שאלה אחת שאפשר לצאת ממנה:</p>
        <Tag className="mt-4">{main.pillarName}</Tag>
        <p className="mt-3 font-display text-2xl leading-snug text-ink">
          <span className="highlighted">{main.prompt}</span>
        </p>
        <Button asChild variant="primary" size="lg" className="mt-6">
          <Link href={`/create?prompt=${encodeURIComponent(main.prompt)}`}>לכתוב על זה</Link>
        </Button>
      </article>
    );
  }
  const note =
    main.kind === "carried_over"
      ? `נשאר מ${main.daysLate === 1 ? "אתמול" : `לפני ${main.daysLate} ימים`}`
      : main.kind === "ready"
        ? "לא תוכנן משהו להיום, אז הנה משהו שכבר מוכן"
        : null;
  return <ContentFocus item={main.item} note={note} render={render} assetUrls={assetUrls} warnings={warnings} />;
}

function useFrames(item: Content, render: RenderContext, assetUrls: AssetUrls) {
  return useMemo(() => {
    const frames = planFrames(item, render.templates, render.settings, (id) => assetUrls[id]?.preview);
    return { frames, docs: documentsFor(frames, CLIENT_FONT_CSS, true) };
  }, [item, render, assetUrls]);
}

function captionText(item: Content) {
  return [item.caption, item.cta].filter(Boolean).join("\n\n");
}

function storyText(item: Content) {
  return (item.body.frames ?? [])
    .map((f) => [f.text, ...(f.options ?? [])].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function ContentFocus({ item, note, render, assetUrls, warnings }: { item: Content; note: string | null; render: RenderContext; assetUrls: AssetUrls; warnings: string[] }) {
  const { frames, docs } = useFrames(item, render, assetUrls);
  const pov = item.body.pov;
  const filmed = FILMED_FORMATS.has(item.format);
  const graphic = hasGraphics(item.format);
  const copy = captionText(item) || storyText(item) || item.hook || "";
  const hook = item.hook || pov?.onScreenText || item.body.slides?.[0]?.text || item.body.frames?.[0]?.text || item.topic || "";

  return (
    <article className="overflow-hidden rounded-card border border-rule bg-surface shadow-lift" aria-labelledby="today-hook">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 sm:p-7">
          {note && <p className="mb-3 text-sm font-medium text-status-progress">{note}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <FormatTag format={item.format} />
            <PillarTag name={item.pillar?.name} />
            {item.calendar?.plan_day && <Tag tone="muted">יום {item.calendar.plan_day} בתוכנית</Tag>}
            {item.prep_minutes ? <Tag tone="muted">כ־{item.prep_minutes} דק׳ הכנה</Tag> : null}
            <StatusPill status={item.status} className="ms-auto" />
          </div>

          {warnings.map((w) => (
            <p key={w} className="mt-3 rounded-field bg-highlight-soft px-3 py-1.5 text-sm text-ink">
              {w}
            </p>
          ))}

          <h2 id="today-hook" className="mt-5 font-display text-2xl font-medium leading-snug text-ink sm:text-3xl">
            <span className="highlighted">{hook}</span>
          </h2>

          {graphic && docs.length > 0 && (
            <div className="-mx-5 mt-6 sm:-mx-7 lg:hidden">
              <FrameStrip docs={docs} labels={frames.map((f) => f.label)} format={frames[0].input.format} />
            </div>
          )}

          <dl className="mt-6 flex flex-col gap-5 text-[15px] leading-relaxed">
            {pov && filmed && (
              <Detail label="מה מצלמים">
                <p className="whitespace-pre-line">{pov.action || pov.shot || item.visual_notes}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pov.length && <Tag>{pov.length}</Tag>}
                  {pov.location && <Tag>{pov.location}</Tag>}
                  {pov.sound && <Tag tone="muted">{pov.sound}</Tag>}
                  {pov.gameAppears && <Tag tone="highlight">המשחק בפריים</Tag>}
                </div>
              </Detail>
            )}
            {!filmed && item.visual_notes && <Detail label="ויזואל">{item.visual_notes}</Detail>}
            {item.format === "carousel" && item.body.slides && (
              <Detail label={`${item.body.slides.length} שקפים`}>
                <ol className="list-inside list-decimal marker:text-mist">
                  {item.body.slides.map((s) => (
                    <li key={s.id} className="py-0.5">
                      {s.text}
                    </li>
                  ))}
                </ol>
              </Detail>
            )}
            {item.caption && <Detail label="כיתוב"><p className="whitespace-pre-line">{item.caption}</p></Detail>}
            {item.cta && <Detail label="הנעה לפעולה">{item.cta}</Detail>}
            {item.supporting_story && <Detail label="סטורי המשך">{item.supporting_story}</Detail>}
            <NeedsBlock item={item} />
          </dl>

          <div className="mt-7 flex flex-wrap gap-2">
            <CopyButton text={copy} label={item.caption ? "העתק כיתוב" : "העתק"} variant="primary" className="flex-1 sm:flex-none" />
            <Button asChild className="flex-1 sm:flex-none">
              <Link href={`/content/${item.id}`}>ערוך</Link>
            </Button>
            {graphic && (
              <Button asChild className="flex-1 sm:flex-none">
                <Link href={`/content/${item.id}?tab=visual`}>צור עיצוב</Link>
              </Button>
            )}
          </div>

          <StatusActions id={item.id} format={item.format} status={item.status} className="mt-3" />
          <RewriteChips id={item.id} />
        </div>

        {graphic && docs.length > 0 && (
          <aside className="hidden border-s border-rule bg-paper p-6 lg:block" aria-label="תצוגה מקדימה">
            <FramePreview html={docs[0]} size={canvasSize(frames[0].input.format)} label={frames[0].label} />
            {docs.length > 1 && <p className="mt-3 text-center text-xs text-graphite">ועוד {docs.length - 1} {item.format === "carousel" ? "שקפים" : "פריימים"}</p>}
          </aside>
        )}
      </div>
    </article>
  );
}

function NeedsBlock({ item }: { item: Content }) {
  const any = item.requires_filming || item.requires_product || item.requires_barak || item.requires_couple;
  if (!any) return null;
  return (
    <Detail label="מה צריך">
      <NeedsList item={item} />
    </Detail>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-graphite">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

function FrameStrip({ docs, labels, format }: { docs: string[]; labels: string[]; format: "story" | "carousel" }) {
  const size = canvasSize(format);
  return (
    <ul className="scroll-snap-x no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1 sm:px-7" aria-label="תצוגה מקדימה">
      {docs.map((html, i) => (
        <li key={i} className="w-[42%] max-w-44 shrink-0 snap-start">
          <FramePreview html={html} size={size} label={labels[i]} />
        </li>
      ))}
    </ul>
  );
}

const QUICK_REWRITES: FeedbackKind[] = ["other_direction", "more_personal", "less_promotional"];

function RewriteChips({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-rule pt-4">
      <IconSparkle size={16} className="text-graphite" />
      {QUICK_REWRITES.map((kind) => (
        <button
          key={kind}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await rewriteContent(id, kind);
              if (result.ok) toast.success("נוצרה גרסה חדשה. אפשר לראות אותה בעורך.");
              else toast(result.error, { description: result.needsProvider ? "אפשר לחבר מפתח בהגדרות. בינתיים העורך עובד כרגיל." : undefined });
            })
          }
          className="h-9 rounded-chip px-3 text-sm text-ink-soft hover:bg-paper-deep disabled:opacity-50"
        >
          {kind === "other_direction" ? "צור גרסה אחרת" : FEEDBACK_LABEL[kind]}
        </button>
      ))}
    </div>
  );
}

function QuickStory({ item, render, assetUrls }: { item: Content; render: RenderContext; assetUrls: AssetUrls }) {
  const { frames, docs } = useFrames(item, render, assetUrls);
  const text = storyText(item) || item.hook || item.visual_notes || "";
  return (
    <section className="mt-10" aria-labelledby="ten-minutes">
      <h2 id="ten-minutes" className="font-display text-xl text-ink">
        יש לך עוד 10 דקות?
      </h2>
      <p className="mt-1 text-sm text-graphite">סטורי קטן שאפשר להעלות עכשיו.</p>
      <article className="mt-3 flex gap-4 rounded-card border border-rule bg-surface p-4">
        {docs[0] ? (
          <div className="w-24 shrink-0 sm:w-28">
            <FramePreview html={docs[0]} size={canvasSize("story")} label={frames[0].label} />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-relaxed text-ink">{text}</p>
          {item.cta && <p className="mt-1 text-xs text-graphite">{item.cta}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <CopyButton text={text} size="sm" />
            <Button asChild size="sm">
              <Link href={`/content/${item.id}?tab=visual`}>עיצוב והורדה</Link>
            </Button>
          </div>
        </div>
      </article>
    </section>
  );
}

function CompactRow({ item, today }: { item: Content; today: string }) {
  const title = item.hook || item.body.pov?.onScreenText || item.body.slides?.[0]?.text || item.topic || "בלי כותרת";
  return (
    <li>
      <Link
        href={`/content/${item.id}`}
        className="flex items-center gap-3 rounded-card border border-rule bg-surface px-4 py-3 transition-colors hover:border-rule-strong"
      >
        <span className="w-16 shrink-0 text-xs text-graphite">
          {item.calendar ? relativeDayLabel(item.calendar.scheduled_on, today) : formatDayShort(today)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-ink">{title}</span>
          <span className="mt-0.5 flex items-center gap-2">
            <FormatTag format={item.format} />
            <NeedsList item={item} compact />
          </span>
        </span>
        <StatusPill status={item.status} className="hidden sm:inline-flex" />
      </Link>
    </li>
  );
}
