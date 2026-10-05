"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AUDIENCE_SOURCE_LABEL, AUDIENCE_SOURCE_TYPES, FORMAT_LABEL, PERMISSION_LABEL, type AudienceSourceType, type ContentFormat } from "@/lib/domain/constants";
import { addAudienceEntry, audienceHooks, audienceToIdea, deleteAudienceEntry, updateAudienceEntry } from "@/lib/audience/actions";
import { formatDayShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/shell/page";

type Entry = { id: string; original_text: string; source_type: string; topic: string | null; received_on: string | null; permission_status: string; notes: string | null; created_at: string };

export function AudienceView({ entries, usage, providerAvailable }: { entries: Entry[]; usage: Record<string, number>; providerAvailable: boolean }) {
  const [filter, setFilter] = useState<AudienceSourceType | "all" | "unused">("all");
  const shown = entries.filter((e) => (filter === "all" ? true : filter === "unused" ? !usage[e.id] : e.source_type === filter));
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">הקהל</h1>
      <p className="mt-1 text-sm text-graphite">איך זוגות מדברים באמת. פרטי לגמרי: שמות ופרטים מזהים לא נכנסים לשום תוכן.</p>
      <AddEntry />
      <div className="no-scrollbar -mx-4 mt-8 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Chip size="sm" selected={filter === "all"} onClick={() => setFilter("all")}>
          הכל ({entries.length})
        </Chip>
        <Chip size="sm" selected={filter === "unused"} onClick={() => setFilter("unused")}>
          עוד לא השתמשנו
        </Chip>
        {AUDIENCE_SOURCE_TYPES.map((t) => (
          <Chip key={t} size="sm" selected={filter === t} onClick={() => setFilter(t)}>
            {AUDIENCE_SOURCE_LABEL[t]}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={entries.length ? "אין כאן כלום בסינון הזה" : "עוד לא שמרנו משפטים מהקהל"}>
            {entries.length ? null : "תשובה לסטורי, הודעה, תגובה. מעתיקים את המשפט כמו שהוא. לרוב הוא טוב יותר מכל מה שהיינו כותבים."}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3 pb-10">
          {shown.map((entry) => (
            <EntryCard key={entry.id} entry={entry} used={usage[entry.id] ?? 0} providerAvailable={providerAvailable} />
          ))}
        </ul>
      )}
    </main>
  );
}

function AddEntry() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [source, setSource] = useState<AudienceSourceType>("story_reply");
  const [topic, setTopic] = useState("");
  const [permission, setPermission] = useState("not_needed");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-6 flex flex-col gap-3 rounded-card border border-rule bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await addAudienceEntry({ original_text: text, source_type: source, topic: topic || null, permission_status: permission as "not_needed", received_on: new Date().toISOString().slice(0, 10) });
          if (!result.ok) return void toast.error(result.error);
          setText("");
          setTopic("");
          toast.success("נשמר");
          router.refresh();
        });
      }}
    >
      <Field label="מה נכתב">{(p) => <Textarea {...p} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="חשבתי שרק אנחנו רבים על הרשימת מוזמנים" className="font-display text-lg" />}</Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="מאיפה">
          {(p) => (
            <Select {...p} value={source} onChange={(e) => setSource(e.target.value as AudienceSourceType)}>
              {AUDIENCE_SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {AUDIENCE_SOURCE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="נושא">{(p) => <Input {...p} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="רשימת מוזמנים" />}</Field>
        <Field label="אישור" className="col-span-2 sm:col-span-1">
          {(p) => (
            <Select {...p} value={permission} onChange={(e) => setPermission(e.target.value)}>
              {Object.entries(PERMISSION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" variant="primary" pending={pending} disabled={text.trim().length < 2} className="self-start">
        שמירה
      </Button>
    </form>
  );
}

function EntryCard({ entry, used, providerAvailable }: { entry: Entry; used: number; providerAvailable: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hooks, setHooks] = useState<Array<{ hook: string; format: string; why: string }> | null>(null);
  return (
    <li className="rounded-card border border-rule bg-surface p-4">
      <blockquote className="border-s-4 border-highlight ps-3 font-display text-lg leading-snug">&quot;{entry.original_text}&quot;</blockquote>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag>{AUDIENCE_SOURCE_LABEL[entry.source_type as AudienceSourceType]}</Tag>
        {entry.topic && <Tag tone="muted">{entry.topic}</Tag>}
        {entry.permission_status !== "not_needed" && <Tag tone={entry.permission_status === "granted" ? "pen" : "highlight"}>{PERMISSION_LABEL[entry.permission_status]}</Tag>}
        <span className="text-xs text-mist">{formatDayShort((entry.received_on ?? entry.created_at).slice(0, 10))}</span>
        <span className={cn("ms-auto text-xs", used ? "text-status-done" : "text-graphite")}>{used ? `שימש ב־${used} תכנים` : "עוד לא שימש"}</span>
      </div>
      {hooks && (
        <ul className="mt-3 flex flex-col gap-2">
          {hooks.map((h) => (
            <li key={h.hook} className="rounded-field bg-paper p-3">
              <p className="text-[15px]">{h.hook}</p>
              <p className="mt-1 text-xs text-graphite">
                {FORMAT_LABEL[h.format as ContentFormat] ?? h.format} | {h.why}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="primary">
          <Link href={`/create?audience=${entry.id}`}>הפוך לרעיון תוכן</Link>
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await audienceToIdea(entry.id);
              if (!r.ok) return void toast.error(r.error);
              toast.success("נוסף לרעיונות");
            })
          }
        >
          לשמור ברעיונות
        </Button>
        {providerAvailable && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await audienceHooks(entry.id);
                if (!r.ok) return void toast(r.error);
                setHooks(r.data);
              })
            }
          >
            הוקים בשפה שלהם
          </Button>
        )}
        <select
          aria-label="סטטוס אישור"
          value={entry.permission_status}
          onChange={(e) =>
            startTransition(async () => {
              const r = await updateAudienceEntry(entry.id, { permission_status: e.target.value as "pending" });
              if (!r.ok) toast.error(r.error);
              router.refresh();
            })
          }
          className="h-9 rounded-chip border border-rule bg-surface px-3 text-xs text-ink-soft"
        >
          {Object.entries(PERMISSION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!window.confirm("למחוק את המשפט?")) return;
              const r = await deleteAudienceEntry(entry.id);
              if (!r.ok) toast.error(r.error);
              router.refresh();
            })
          }
        >
          מחיקה
        </Button>
      </div>
    </li>
  );
}
