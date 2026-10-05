"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CONTENT_FORMATS, CONTENT_STATUSES, FORMAT_LABEL, LOCATION_CATEGORIES, STATUS_LABEL, type ContentFormat, type ContentStatus } from "@/lib/domain/constants";
import { scheduleContent, setContentStatus } from "@/lib/content/actions";
import { statusesForFormat } from "@/lib/domain/status";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusActions } from "@/components/content/status-actions";
import { useEditor } from "../editor-context";

export function DetailsPanel() {
  const { draft, setField, pillars, status, setStatus, id, calendar } = useEditor();
  const [date, setDate] = useState(calendar?.scheduled_on ?? "");
  const [time, setTime] = useState(calendar?.scheduled_time?.slice(0, 5) ?? "");
  const [pending, startTransition] = useTransition();

  const changeStatus = (next: ContentStatus) =>
    startTransition(async () => {
      const prev = status;
      setStatus(next);
      const result = await setContentStatus(id, next);
      if (!result.ok) {
        setStatus(prev);
        toast.error(result.error);
      }
    });

  const saveSchedule = (nextDate: string, nextTime: string) =>
    startTransition(async () => {
      const result = await scheduleContent(id, nextDate || null, nextTime || null);
      if (result.ok) toast.success(nextDate ? "התאריך נשמר" : "הוסר מהלוח");
      else toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="status-title" className="flex flex-col gap-3">
        <h2 id="status-title" className="font-display text-xl">
          סטטוס
        </h2>
        <StatusActions key={status} id={id} format={draft.format} status={status} onChange={setStatus} />
        <Select aria-label="כל הסטטוסים" value={status} disabled={pending} onChange={(e) => changeStatus(e.target.value as ContentStatus)}>
          {statusesForFormat(draft.format).concat(CONTENT_STATUSES.filter((s) => s === status && !statusesForFormat(draft.format).includes(s))).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </section>

      <section aria-labelledby="when-title" className="flex flex-col gap-3">
        <h2 id="when-title" className="font-display text-xl">
          מתי
        </h2>
        <p className="text-xs text-graphite">תזמון פנימי לתכנון. הפרסום עצמו נעשה באינסטגרם.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="שעה">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        </div>
        <div className="flex gap-2">
          <Button pending={pending} onClick={() => saveSchedule(date, time)} disabled={!date}>
            שמירת מועד
          </Button>
          {calendar && (
            <Button
              variant="ghost"
              onClick={() => {
                setDate("");
                setTime("");
                saveSchedule("", "");
              }}
            >
              להסיר מהלוח
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="what-title" className="flex flex-col gap-4">
        <h2 id="what-title" className="font-display text-xl">
          מה זה
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="פורמט">
            {(p) => (
              <Select {...p} value={draft.format} onChange={(e) => setField("format", e.target.value as ContentFormat)}>
                {CONTENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="עמוד תוכן">
            {(p) => (
              <Select {...p} value={draft.pillar_id ?? ""} onChange={(e) => setField("pillar_id", e.target.value || null)}>
                <option value="">בלי</option>
                {pillars.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">המשחק בתוכן</legend>
          <div className="grid grid-cols-3 gap-1 rounded-chip border border-rule bg-surface p-1" role="radiogroup">
            {(
              [
                ["none", "לא מופיע"],
                ["natural", "בטבעיות"],
                ["direct", "תוכן מוצר"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={draft.product_presence === value}
                onClick={() => setField("product_presence", value)}
                className={cn("h-10 rounded-chip text-sm font-medium", draft.product_presence === value ? "bg-ink text-paper" : "text-ink-soft")}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 text-sm font-medium text-ink-soft">מה צריך</legend>
          {(
            [
              ["requires_filming", "צילום"],
              ["requires_product", "המשחק"],
              ["requires_barak", "ברק"],
              ["requires_couple", "זוג נוסף"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 rounded-field border border-rule bg-surface px-3 text-[15px]">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-pen)]" checked={draft[key]} onChange={(e) => setField(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="זמן הכנה (דקות)">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                value={draft.prep_minutes ?? ""}
                onChange={(e) => setField("prep_minutes", e.target.value === "" ? null : Math.max(0, Math.min(600, Number(e.target.value))))}
              />
            )}
          </Field>
          <Field label="איפה">
            {(p) => (
              <Select {...p} value={draft.location_category ?? ""} onChange={(e) => setField("location_category", e.target.value || null)}>
                <option value="">לא משנה</option>
                {LOCATION_CATEGORIES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="notes-title" className="flex flex-col gap-3">
        <h2 id="notes-title" className="font-display text-xl">
          הערות
        </h2>
        <Field label="ויזואל / מה לצלם או לעצב">
          {(p) => <Textarea {...p} rows={2} value={draft.visual_notes ?? ""} onChange={(e) => setField("visual_notes", e.target.value || null)} />}
        </Field>
        <Field label="הערות פנימיות">
          {(p) => <Textarea {...p} rows={3} value={draft.notes ?? ""} onChange={(e) => setField("notes", e.target.value || null)} placeholder="רק לנו. לא נכנס לשום פרסום." />}
        </Field>
      </section>
    </div>
  );
}
