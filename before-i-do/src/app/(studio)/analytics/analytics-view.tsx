"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAnalytics } from "@/lib/analytics/actions";
import { CONFIDENCE_LABEL, METRICS, SIGNALS, type MeasuredContent, type MetricKey, type Pattern, type RatioShare } from "@/lib/analytics/patterns";
import { FORMAT_LABEL, RATIO_LABEL, RATIO_TARGET, type RatioGroup } from "@/lib/domain/constants";
import { formatDayShort, todayISO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shell/page";

export type PublishedRow = MeasuredContent & { ratioGroup: RatioGroup | null; publishedAt: string | null; recordedOn: string | null; notes: string | null };

const METRIC_LABEL = Object.fromEntries(METRICS.map((m) => [m.key, m.label])) as Record<MetricKey, string>;
const num = new Intl.NumberFormat("he-IL");

export function AnalyticsView({ rows, patterns, ratio, recentCount }: { rows: PublishedRow[]; patterns: Pattern[]; ratio: RatioShare[]; recentCount: number }) {
  const [editing, setEditing] = useState<PublishedRow | null>(null);
  const waiting = rows.filter((r) => !r.recordedOn);
  const measured = rows.filter((r) => r.recordedOn);

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">מה עבד</h1>
      <p className="mt-1 text-sm text-graphite">שיתופים, שמירות ותשובות. אלה הסימנים שמישהו הרגיש &quot;זה אנחנו&quot;.</p>

      <section aria-labelledby="us-title" className="mt-8">
        <h2 id="us-title" className="font-display text-xl">מה גרם לאנשים להגיד &quot;זה אנחנו&quot;?</h2>
        {patterns.length ? (
          <>
            <ul className="mt-4 flex flex-col gap-3">
              {patterns.map((p) => (
                <li key={p.id} className="rounded-card border border-rule bg-surface px-4 py-3">
                  <p className="text-[17px] leading-snug">{p.text}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-graphite">
                    <Tag tone={p.confidence === "pattern" ? "pen" : "muted"}>{CONFIDENCE_LABEL[p.confidence]}</Tag>
                    מתוך {p.n} פרסומים
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-graphite">אלה דברים שקרו ביחד, לא בהכרח סיבה ותוצאה. ככל שיהיו יותר מספרים, התמונה תתחדד.</p>
          </>
        ) : (
          <p className="mt-3 rounded-card border border-dashed border-rule-strong px-4 py-5 text-sm text-graphite">
            עוד אין מספיק מספרים כדי לראות דפוס. צריך מספרים על לפחות 6 פרסומים{measured.length ? `, יש כרגע ${measured.length}` : ""}. עד אז כל מסקנה תהיה ניחוש.
          </p>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="waiting-title" className="mt-10">
          <h2 id="waiting-title" className="font-display text-xl">פורסם, מחכה למספרים</h2>
          <p className="mt-1 text-sm text-graphite">דקה לכל אחד: פותחים את התובנות באינסטגרם ומעתיקים שלושה מספרים.</p>
          <ul className="mt-3 flex flex-col divide-y divide-rule rounded-card border border-rule bg-surface">
            {waiting.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{r.title}</p>
                  <p className="text-xs text-graphite">
                    {FORMAT_LABEL[r.format]}
                    {r.publishedAt ? ` · ${formatDayShort(r.publishedAt.slice(0, 10))}` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => setEditing(r)}>
                  הוספת מספרים
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {measured.length > 0 && (
        <section aria-labelledby="top-title" className="mt-10">
          <h2 id="top-title" className="font-display text-xl">מה הכי</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {SIGNALS.map((signal) => {
              const top = measured
                .filter((r) => (r.metrics[signal] ?? 0) > 0)
                .sort((a, b) => (b.metrics[signal] ?? 0) - (a.metrics[signal] ?? 0))
                .slice(0, 3);
              return (
                <div key={signal}>
                  <h3 className="text-sm font-medium text-ink-soft">{METRIC_LABEL[signal]}</h3>
                  {top.length ? (
                    <ol className="mt-2 flex flex-col gap-2">
                      {top.map((r) => (
                        <li key={r.id} className="flex items-baseline gap-2">
                          <span className="font-display text-lg tabular-nums">{num.format(r.metrics[signal] ?? 0)}</span>
                          <Link href={`/content/${r.id}`} className="min-w-0 truncate text-sm hover:text-pen">
                            {r.title}
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-mist">עוד אין</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="ratio-title" className="mt-10">
        <h2 id="ratio-title" className="font-display text-xl">האיזון ב־30 הימים האחרונים</h2>
        <p className="mt-1 text-sm text-graphite">{recentCount ? `${recentCount} פרסומים. היעד בערך 70/20/10, כקו מנחה ולא כחוק.` : "עוד לא פורסם כלום בחודש האחרון."}</p>
        {recentCount > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {ratio.map((r) => (
              <li key={r.group}>
                <div className="flex justify-between text-sm">
                  <span>{RATIO_LABEL[r.group]}</span>
                  <span className="tabular-nums text-graphite">
                    {Math.round(r.share * 100)}% <span className="text-mist">/ {Math.round(RATIO_TARGET[r.group] * 100)}%</span>
                  </span>
                </div>
                <div className="relative mt-1 h-2 rounded-full bg-paper-deep">
                  <div className="h-full rounded-full bg-ink/70" style={{ width: `${r.share * 100}%` }} />
                  <div className="absolute top-[-3px] h-[14px] w-0.5 bg-pen" style={{ insetInlineStart: `${RATIO_TARGET[r.group] * 100}%` }} aria-hidden />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {measured.length > 0 && (
        <section aria-labelledby="all-title" className="mt-10">
          <h2 id="all-title" className="font-display text-xl">כל מה שנמדד</h2>
          <ul className="mt-3 flex flex-col divide-y divide-rule">
            {measured.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setEditing(r)} className="flex w-full items-center gap-3 py-3 text-start hover:bg-paper-deep/50">
                  <span className="min-w-0 flex-1 truncate text-[15px]">{r.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-graphite">
                    {SIGNALS.map((s) => `${num.format(r.metrics[s] ?? 0)} ${METRIC_LABEL[s]}`).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 && (
        <div className="mt-8">
          <EmptyState title="עוד לא פורסם כלום" action={<Link href="/" className="text-sm font-medium text-pen">למה מעלים היום</Link>}>
            כשמשהו מסומן &quot;פורסם&quot; הוא יופיע כאן, ואפשר יהיה להוסיף לו מספרים.
          </EmptyState>
        </div>
      )}

      {editing && <MetricsSheet row={editing} onClose={() => setEditing(null)} />}
    </main>
  );
}

function MetricsSheet({ row, onClose }: { row: PublishedRow; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(METRICS.map((m) => [m.key, row.metrics[m.key] != null ? String(row.metrics[m.key]) : ""])));
  const [recordedOn, setRecordedOn] = useState(todayISO());
  const [notes, setNotes] = useState(row.notes ?? "");
  const [pending, startTransition] = useTransition();

  const field = (key: MetricKey, big: boolean) => (
    <label key={key} className="flex flex-col gap-1">
      <span className={cn("text-ink-soft", big ? "text-sm font-medium" : "text-xs")}>{METRIC_LABEL[key]}</span>
      <Input inputMode="numeric" pattern="[0-9]*" value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value.replace(/[^\d]/g, "") }))} className={big ? "text-lg" : ""} />
    </label>
  );

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="מספרים"
      description={row.title}
      footer={
        <Button
          variant="primary"
          className="w-full"
          pending={pending}
          onClick={() =>
            startTransition(async () => {
              const metrics = Object.fromEntries(METRICS.map((m) => [m.key, values[m.key] === "" ? null : Number(values[m.key])]));
              const result = await saveAnalytics({ contentId: row.id, recordedOn, metrics, notes });
              if (!result.ok) return void toast.error(result.error);
              toast.success("נשמר");
              onClose();
              router.refresh();
            })
          }
        >
          שמירה
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-3">{METRICS.filter((m) => m.primary).map((m) => field(m.key, true))}</div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-graphite">עוד מספרים (לא חובה)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{METRICS.filter((m) => !m.primary).map((m) => field(m.key, false))}</div>
      </details>
      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs text-ink-soft">נכון לתאריך</span>
        <Input type="date" value={recordedOn} max={todayISO()} onChange={(e) => setRecordedOn(e.target.value)} />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-ink-soft">מה אנשים כתבו? (לא חובה)</span>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
    </Sheet>
  );
}
