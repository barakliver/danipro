"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type { Content, PillarRef } from "@/lib/content/types";
import { moveContent } from "@/lib/content/actions";
import { CONTENT_STATUSES, FORMAT_LABEL, STATUS_LABEL, type ContentFormat, type ContentStatus } from "@/lib/domain/constants";
import { statusTone } from "@/lib/domain/status";
import { addDays, diffDays, formatDayLong, formatMonth, formatWeekdayShort, startOfMonth, startOfWeek, weekday } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { IconChevronEnd, IconChevronStart } from "@/components/ui/icons";
import { FormatTag, NeedsList, PillarTag, StatusPill } from "@/components/content/meta";

type View = "month" | "week" | "list";
type Filters = { status: ContentStatus | "open" | "all"; format: ContentFormat | "all"; pillar: string; stories: boolean };

/** A drop ends with a pointerup that would also "click" the card; swallow that one click. */
let lastDragEnd = 0;

const VIEW_LABEL: Record<View, string> = { week: "שבוע", month: "חודש", list: "רשימה" };

function titleOf(item: Content) {
  return item.hook || item.body.pov?.onScreenText || item.body.slides?.[0]?.text || item.body.frames?.[0]?.text || item.visual_notes || item.topic || "בלי כותרת";
}

export function CalendarView({ items, pillars, today, anchor: initialAnchor, initialView }: { items: Content[]; pillars: PillarRef[]; today: string; anchor: string; initialView: View }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [filters, setFilters] = useState<Filters>({ status: "all", format: "all", pillar: "all", stories: false });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimisticItems, moveOptimistic] = useOptimistic(items, (state, move: { id: string; date: string }) =>
    state.map((c) => (c.id === move.id ? { ...c, calendar: { ...(c.calendar ?? { scheduled_time: null, plan_day: null, slot: "main" as const }), scheduled_on: move.date } } : c)),
  );

  const visible = useMemo(
    () =>
      optimisticItems.filter((c) => {
        if (!filters.stories && c.calendar?.slot === "story") return false;
        if (filters.status === "open" && c.status === "published") return false;
        if (filters.status !== "all" && filters.status !== "open" && c.status !== filters.status) return false;
        if (filters.format !== "all" && c.format !== filters.format) return false;
        if (filters.pillar !== "all" && c.pillar_id !== filters.pillar) return false;
        return true;
      }),
    [optimisticItems, filters],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Content[]>();
    for (const c of visible) {
      const day = c.calendar?.scheduled_on;
      if (!day) continue;
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => Number(a.calendar?.slot === "story") - Number(b.calendar?.slot === "story"));
    return map;
  }, [visible]);

  const unscheduled = visible.filter((c) => !c.calendar && c.status !== "published");

  const move = (id: string, date: string) => {
    startTransition(async () => {
      moveOptimistic({ id, date });
      const result = await moveContent(id, date);
      if (!result.ok) toast.error(result.error);
      else toast.success(`הועבר ל${formatDayLong(date)}`);
      router.refresh();
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [dragging, setDragging] = useState<Content | null>(null);
  const onDragStart = (e: DragStartEvent) => setDragging(optimisticItems.find((c) => c.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    lastDragEnd = Date.now();
    const date = e.over?.id;
    const item = optimisticItems.find((c) => c.id === e.active.id);
    if (typeof date === "string" && item && item.calendar?.scheduled_on !== date) move(item.id, date);
  };

  const step = (dir: 1 | -1) => {
    if (view === "month") {
      const [y, m] = anchor.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
      setAnchor(next);
    } else setAnchor(addDays(anchor, dir * 7));
  };

  const heading = view === "month" ? formatMonth(anchor) : view === "week" ? weekHeading(startOfWeek(anchor)) : "כל התוכן לפי תאריך";

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium lg:text-3xl">לוח תוכן</h1>
          <p className="mt-1 text-sm text-graphite">{heading}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-chip border border-rule bg-surface p-1" role="tablist" aria-label="תצוגה">
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("h-9 rounded-chip px-3.5 text-sm font-medium", view === v ? "bg-ink text-paper" : "text-ink-soft")}>
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {view !== "list" && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="הקודם" onClick={() => step(-1)}>
              <IconChevronStart size={20} />
            </Button>
            <Button size="sm" onClick={() => setAnchor(today)}>
              היום
            </Button>
            <Button size="icon" variant="ghost" aria-label="הבא" onClick={() => step(1)}>
              <IconChevronEnd size={20} />
            </Button>
          </div>
        )}
        <FilterBar filters={filters} setFilters={setFilters} pillars={pillars} />
      </div>

      <DndContext id="calendar-dnd" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="mt-5">
          {view === "month" && <MonthGrid anchor={anchor} today={today} byDay={byDay} selectedDay={selectedDay} onSelectDay={setSelectedDay} />}
          {view === "week" && <WeekColumns anchor={anchor} today={today} byDay={byDay} />}
          {view === "list" && <ListView today={today} byDay={byDay} />}
        </div>
        <DragOverlay dropAnimation={null}>{dragging ? <CardBody item={dragging} compact /> : null}</DragOverlay>
      </DndContext>

      {view === "month" && selectedDay && (
        <section className="mt-6" aria-label={formatDayLong(selectedDay)}>
          <h2 className="mb-2 font-display text-lg">{formatDayLong(selectedDay)}</h2>
          <DayList items={byDay.get(selectedDay) ?? []} />
        </section>
      )}

      {unscheduled.length > 0 && (
        <section className="mt-10" aria-labelledby="unscheduled">
          <h2 id="unscheduled" className="font-display text-lg">
            בלי תאריך
          </h2>
          <p className="text-sm text-graphite">אפשר לגרור יום בלוח, או לבחור תאריך בעורך.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {unscheduled.map((c) => (
              <li key={c.id}>
                <DraggableCard item={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function weekHeading(start: string) {
  const end = addDays(start, 6);
  return `${formatDayLong(start)} עד ${formatDayLong(end)}`;
}

function FilterBar({ filters, setFilters, pillars }: { filters: Filters; setFilters: (f: Filters) => void; pillars: PillarRef[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <Chip size="sm" selected={filters.status === "open"} onClick={() => setFilters({ ...filters, status: filters.status === "open" ? "all" : "open" })}>
        עוד לא פורסם
      </Chip>
      <Chip size="sm" selected={filters.stories} onClick={() => setFilters({ ...filters, stories: !filters.stories })}>
        גם סטוריז יומיים
      </Chip>
      <select
        aria-label="פורמט"
        value={filters.format}
        onChange={(e) => setFilters({ ...filters, format: e.target.value as Filters["format"] })}
        className="h-8 shrink-0 rounded-chip border border-rule bg-surface px-3 text-xs text-ink-soft"
      >
        <option value="all">כל הפורמטים</option>
        {(Object.keys(FORMAT_LABEL) as ContentFormat[]).map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABEL[f]}
          </option>
        ))}
      </select>
      <select
        aria-label="עמוד תוכן"
        value={filters.pillar}
        onChange={(e) => setFilters({ ...filters, pillar: e.target.value })}
        className="h-8 shrink-0 rounded-chip border border-rule bg-surface px-3 text-xs text-ink-soft"
      >
        <option value="all">כל העמודים</option>
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label="סטטוס"
        value={filters.status === "open" ? "all" : filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}
        className="h-8 shrink-0 rounded-chip border border-rule bg-surface px-3 text-xs text-ink-soft"
      >
        <option value="all">כל הסטטוסים</option>
        {CONTENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

const TONE_STRIPE = {
  draft: "before:bg-status-draft",
  progress: "before:bg-status-progress",
  ready: "before:bg-status-ready",
  done: "before:bg-status-done",
};

function CardBody({ item, compact = false }: { item: Content; compact?: boolean }) {
  const story = item.calendar?.slot === "story";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[12px] border bg-surface ps-3 pe-2.5 text-start shadow-[0_1px_0_rgba(29,36,64,0.03)] before:absolute before:inset-y-0 before:start-0 before:w-1",
        TONE_STRIPE[statusTone(item.status)],
        story ? "border-dashed border-rule" : "border-rule",
        compact ? "py-1.5" : "py-2.5",
        item.status === "published" && "opacity-70",
      )}
    >
      <p className={cn("text-ink", compact ? "line-clamp-2 text-xs leading-snug" : "line-clamp-2 text-sm")}>{titleOf(item)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {compact ? (
          <span className="text-[11px] text-graphite">{FORMAT_LABEL[item.format]}</span>
        ) : (
          <>
            <FormatTag format={item.format} />
            <PillarTag name={item.pillar?.name} />
          </>
        )}
        <NeedsList item={item} compact />
        {!compact && <StatusPill status={item.status} className="ms-auto" />}
      </div>
    </div>
  );
}

function DraggableCard({ item, compact = false }: { item: Content; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  // keep link semantics: dnd-kit would make this role="button"
  const { role: _role, ...dragAttributes } = attributes;
  void _role;
  return (
    <Link
      ref={setNodeRef}
      href={`/content/${item.id}`}
      {...listeners}
      {...dragAttributes}
      onClick={(e) => {
        if (Date.now() - lastDragEnd < 350) e.preventDefault();
      }}
      aria-roledescription="פריט שאפשר לגרור"
      aria-label={`${FORMAT_LABEL[item.format]}: ${titleOf(item)}. ${STATUS_LABEL[item.status]}`}
      className={cn("block touch-manipulation", isDragging && "opacity-30")}
    >
      <CardBody item={item} compact={compact} />
    </Link>
  );
}

function DropDay({ day, children, className, today }: { day: string; children: React.ReactNode; className?: string; today: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-pen ring-offset-1", day === today && "bg-highlight-soft/60")}>
      {children}
    </div>
  );
}

function MonthGrid({ anchor, today, byDay, selectedDay, onSelectDay }: { anchor: string; today: string; byDay: Map<string, Content[]>; selectedDay: string | null; onSelectDay: (d: string) => void }) {
  const first = startOfMonth(anchor);
  const gridStart = addDays(first, -weekday(first));
  const month = first.slice(0, 7);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = days[35].slice(0, 7) === month ? 6 : 5;
  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center text-xs text-graphite" aria-hidden>
        {days.slice(0, 7).map((d) => (
          <div key={d} className="pb-2">
            {formatWeekdayShort(d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={formatMonth(anchor)}>
        {days.slice(0, weeks * 7).map((day) => {
          const list = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month;
          return (
            <DropDay key={day} day={day} today={today} className={cn("min-h-16 rounded-[12px] border border-rule bg-surface p-1 lg:min-h-32", !inMonth && "opacity-45")}>
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                aria-pressed={selectedDay === day}
                aria-label={`${formatDayLong(day)}, ${list.length} פריטים`}
                className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs", day === today ? "bg-ink text-paper" : selectedDay === day ? "bg-pen-wash text-pen-deep" : "text-ink-soft")}
              >
                {Number(day.slice(8))}
              </button>
              {/* phones: dots; wider screens: cards */}
              <div className="mt-1 flex flex-wrap gap-0.5 lg:hidden" aria-hidden>
                {list.slice(0, 4).map((c) => (
                  <span key={c.id} className={cn("h-1.5 w-1.5 rounded-full", { draft: "bg-status-draft", progress: "bg-status-progress", ready: "bg-status-ready", done: "bg-status-done" }[statusTone(c.status)])} />
                ))}
              </div>
              <div className="mt-1 hidden flex-col gap-1 lg:flex">
                {list.slice(0, 3).map((c) => (
                  <DraggableCard key={c.id} item={c} compact />
                ))}
                {list.length > 3 && (
                  <button type="button" onClick={() => onSelectDay(day)} className="text-start text-[11px] text-graphite">
                    ועוד {list.length - 3}
                  </button>
                )}
              </div>
            </DropDay>
          );
        })}
      </div>
    </div>
  );
}

function WeekColumns({ anchor, today, byDay }: { anchor: string; today: string; byDay: Map<string, Content[]> }) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-7 lg:gap-2">
      {days.map((day) => {
        const list = byDay.get(day) ?? [];
        return (
          <DropDay key={day} day={day} today={today} className="rounded-card border border-rule bg-paper p-2 lg:min-h-80">
            <h3 className={cn("mb-2 flex items-baseline justify-between px-1 text-sm", day === today ? "font-semibold text-ink" : "text-ink-soft")}>
              <span>
                {formatWeekdayShort(day)} {Number(day.slice(8))}
              </span>
              {day === today && <span className="text-xs text-pen">היום</span>}
            </h3>
            {list.length === 0 ? (
              <p className="px-1 pb-1 text-xs text-mist">אפשר לגרור לכאן</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {list.map((c) => (
                  <li key={c.id}>
                    <DraggableCard item={c} compact />
                  </li>
                ))}
              </ul>
            )}
          </DropDay>
        );
      })}
    </div>
  );
}

function ListView({ today, byDay }: { today: string; byDay: Map<string, Content[]> }) {
  const days = Array.from(byDay.keys()).sort();
  const upcomingFirst = [...days.filter((d) => d >= today), ...days.filter((d) => d < today).reverse()];
  if (!days.length) return <p className="text-sm text-graphite">אין תוכן שתואם לסינון.</p>;
  return (
    <div className="flex flex-col gap-6">
      {upcomingFirst.map((day, i) => (
        <section key={day} aria-label={formatDayLong(day)}>
          {i > 0 && day < today && upcomingFirst[i - 1] >= today && <h2 className="mb-4 mt-4 font-display text-lg text-graphite">מה שכבר עבר</h2>}
          <h3 className={cn("mb-2 text-sm", day === today ? "font-semibold text-ink" : "text-ink-soft")}>
            {formatDayLong(day)} {day === today ? "(היום)" : diffDays(today, day) === 1 ? "(מחר)" : ""}
          </h3>
          <DayList items={byDay.get(day)!} />
        </section>
      ))}
    </div>
  );
}

function DayList({ items }: { items: Content[] }) {
  if (!items.length) return <p className="text-sm text-graphite">אין כלום ביום הזה.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((c) => (
        <li key={c.id}>
          <DraggableCard item={c} />
        </li>
      ))}
    </ul>
  );
}
