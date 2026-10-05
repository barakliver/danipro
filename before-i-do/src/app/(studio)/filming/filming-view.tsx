"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { FILMING_DURATIONS, FILMING_RESOURCES, FORMAT_LABEL, type FilmingResource } from "@/lib/domain/constants";
import { finishFilmingSession, markShot, startFilmingSession } from "@/lib/filming/actions";
import type { ShotDetail } from "@/lib/filming/load";
import { planFilmingDay, type FilmCandidate, type Look } from "@/lib/filming/plan";
import { formatDayShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { EmptyState } from "@/components/shell/page";
import { IconCheck } from "@/components/ui/icons";

export type ActiveSession = { id: string; minutes: number; looks: Look[]; done: Record<string, boolean> };

const DEFAULT_RESOURCES: FilmingResource[] = ["me", "home", "product"];

export function FilmingView({ candidates, details, active }: { candidates: FilmCandidate[]; details: Record<string, ShotDetail>; active: ActiveSession | null }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">יום צילום</h1>
      {active ? <Checklist session={active} details={details} /> : <Planner candidates={candidates} />}
    </main>
  );
}

function Planner({ candidates }: { candidates: FilmCandidate[] }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState<number>(30);
  const [available, setAvailable] = useState<FilmingResource[]>(DEFAULT_RESOURCES);
  const [pending, startTransition] = useTransition();
  const plan = useMemo(() => planFilmingDay(candidates, minutes, available), [candidates, minutes, available]);
  const shotCount = plan.looks.reduce((n, l) => n + l.shots.length, 0);
  const blocked = plan.skipped.filter((s) => s.reason !== "לא נכנס בזמן");
  const toggle = (key: FilmingResource) => setAvailable((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (!candidates.length) {
    return (
      <div className="mt-6">
        <EmptyState title="אין כרגע משהו שמחכה למצלמה" action={<Link href="/calendar" className="text-sm font-medium text-pen">ללוח התוכן</Link>}>
          כשתוכן מסומן &quot;מוכן לצילום&quot; הוא יופיע כאן ויתקבץ לפי מקום ולוק.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <p className="mt-1 text-sm text-graphite">{candidates.length} רעיונות מחכים למצלמה. בוחרים כמה זמן יש ומה זמין, והם מסתדרים לפי לוקים.</p>

      <section aria-labelledby="time-title" className="mt-6">
        <h2 id="time-title" className="text-sm font-medium text-ink-soft">כמה זמן יש?</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {FILMING_DURATIONS.map((m) => (
            <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)}>
              {m} דק׳
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="have-title" className="mt-5">
        <h2 id="have-title" className="text-sm font-medium text-ink-soft">מה יש היום?</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {FILMING_RESOURCES.map((r) => (
            <Chip key={r.key} selected={available.includes(r.key)} onClick={() => toggle(r.key)}>
              {r.label}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-live="polite" className="mt-8">
        {plan.looks.length ? (
          <>
            <p className="font-display text-xl">
              {shotCount} צילומים ב־{plan.looks.length} {plan.looks.length === 1 ? "לוק" : "לוקים"}, בערך {plan.usedMinutes} דקות
            </p>
            <ol className="mt-4 flex flex-col gap-4">
              {plan.looks.map((look) => (
                <LookCard key={look.number} look={look} />
              ))}
            </ol>
          </>
        ) : (
          <p className="rounded-card border border-dashed border-rule-strong px-5 py-6 text-center text-sm text-graphite">עם מה שסימנת אין מה לצלם. נסי להוסיף זמן, מקום או את המשחק.</p>
        )}
        {blocked.length > 0 && (
          <details className="mt-4 text-sm text-graphite">
            <summary className="cursor-pointer">{blocked.length} לא נכנסו היום</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {blocked.map((s) => (
                <li key={s.id}>
                  {s.title} <span className="text-mist">· {s.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {plan.looks.length > 0 && (
        <div className="sticky bottom-20 z-10 mt-6 lg:bottom-6">
          <Button
            variant="primary"
            className="w-full shadow-lg"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await startFilmingSession({ minutes, available });
                if (!result.ok) return void toast.error(result.error);
                router.refresh();
              })
            }
          >
            יאללה, מתחילים
          </Button>
        </div>
      )}
    </>
  );
}

function LookCard({ look, children }: { look: Look; children?: React.ReactNode }) {
  return (
    <li className="rounded-card border border-rule bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-lg tracking-wide">LOOK {look.number}</span>
        <span className="text-[15px] font-medium">{look.location}</span>
        <span className="text-sm text-graphite">{look.minutes} דק׳</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Tag>{look.camera}</Tag>
        <Tag tone={look.product ? "highlight" : "muted"}>{look.product ? "עם המשחק" : "בלי המשחק"}</Tag>
        {look.people.length > 1 && <Tag tone="pen">{look.people.join(" + ")}</Tag>}
        {look.outfit && <Tag>{look.outfit}</Tag>}
      </div>
      {look.props.length > 0 && <p className="mt-2 text-sm text-graphite">להכין: {look.props.join(", ")}</p>}
      {children ?? (
        <ul className="mt-3 flex flex-col gap-1 text-[15px]">
          {look.shots.map((s) => (
            <li key={s.id} className="flex gap-2">
              <span className="text-mist">·</span>
              <span className="min-w-0 flex-1">{s.title}</span>
              {s.scheduledOn && <span className="shrink-0 text-xs text-graphite">{formatDayShort(s.scheduledOn)}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Checklist({ session, details }: { session: ActiveSession; details: Record<string, ShotDetail> }) {
  const router = useRouter();
  const [done, setDone] = useOptimistic(session.done, (state, update: { id: string; value: boolean }) => ({ ...state, [update.id]: update.value }));
  const [, startTransition] = useTransition();
  const [finishing, startFinish] = useTransition();
  const total = session.looks.reduce((n, l) => n + l.shots.length, 0);
  const completed = session.looks.flatMap((l) => l.shots).filter((s) => done[s.id]).length;

  const toggle = (id: string, value: boolean) =>
    startTransition(async () => {
      setDone({ id, value });
      const result = await markShot(session.id, id, value);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });

  return (
    <>
      <p className="mt-1 text-sm text-graphite">
        {completed} מתוך {total} צולמו. כל מה שמסומן עובר ל&quot;צולם&quot; בלוח.
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-label="התקדמות">
        <div className="h-full rounded-full bg-pen transition-[width] duration-300" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
      </div>

      <ol className="mt-6 flex flex-col gap-4">
        {session.looks.map((look) => (
          <LookCard key={look.number} look={look}>
            <ul className="mt-3 flex flex-col divide-y divide-rule">
              {look.shots.map((shot) => {
                const detail = details[shot.id];
                const checked = Boolean(done[shot.id]);
                return (
                  <li key={shot.id} className="flex items-start gap-3 py-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`צולם: ${shot.title}`}
                      onClick={() => toggle(shot.id, !checked)}
                      className={cn(
                        "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        checked ? "border-pen bg-pen text-paper" : "border-rule-strong bg-surface hover:border-pen",
                      )}
                    >
                      {checked && <IconCheck size={16} />}
                    </button>
                    <div className={cn("min-w-0 flex-1", checked && "opacity-55")}>
                      <Link href={`/content/${shot.id}`} className={cn("text-[15px] font-medium hover:text-pen", checked && "line-through decoration-rule-strong")}>
                        {detail?.onScreenText || shot.title}
                      </Link>
                      {detail?.action && <p className="mt-0.5 text-sm text-graphite">{detail.action}</p>}
                      <p className="mt-1 text-xs text-mist">
                        {detail ? FORMAT_LABEL[detail.format] : ""} · {shot.minutes} דק׳{shot.scheduledOn ? ` · עולה ${formatDayShort(shot.scheduledOn)}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </LookCard>
        ))}
      </ol>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          variant={completed === total ? "primary" : "quiet"}
          pending={finishing}
          onClick={() =>
            startFinish(async () => {
              const result = await finishFilmingSession(session.id);
              if (!result.ok) return void toast.error(result.error);
              toast.success(completed ? `${completed} צילומים בפנים. כל הכבוד.` : "נסגר. אפשר לתכנן מחדש.");
              router.refresh();
            })
          }
        >
          {completed === total ? "סיימנו להיום" : "לסגור ולתכנן מחדש"}
        </Button>
        {completed < total && <p className="text-xs text-graphite">מה שלא צולם נשאר &quot;מוכן לצילום&quot; לפעם הבאה.</p>}
      </div>
    </>
  );
}
