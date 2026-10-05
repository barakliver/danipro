"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { STATUS_LABEL, type ContentFormat, type ContentStatus } from "@/lib/domain/constants";
import { FILMED_FORMATS } from "@/lib/domain/constants";
import { setContentStatus } from "@/lib/content/actions";
import { cn } from "@/lib/utils/cn";
import { IconCheck } from "@/components/ui/icons";

/** The quick status steps a person actually taps: צולם / מוכן / פורסם. */
export function StatusActions({ id, format, status, className }: { id: string; format: ContentFormat; status: ContentStatus; className?: string }) {
  const steps: ContentStatus[] = FILMED_FORMATS.has(format) ? ["filmed", "ready", "published"] : ["ready", "published"];
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(status);

  const order = ["idea", "writing", "ready_to_film", "filmed", "editing", "ready", "scheduled", "published"];
  const reached = (s: ContentStatus) => order.indexOf(optimistic) >= order.indexOf(s);

  return (
    <div className={cn("flex gap-2", className)} role="group" aria-label="סטטוס">
      {steps.map((step) => {
        const done = reached(step);
        const current = optimistic === step;
        return (
          <button
            key={step}
            type="button"
            aria-pressed={current}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                // tapping the current step again steps back one, so a mis-tap is easy to undo
                const next = current ? (order[order.indexOf(step) - 1] as ContentStatus) : step;
                setOptimistic(next);
                const result = await setContentStatus(id, next);
                if (!result.ok) toast.error(result.error);
                else if (next === "published") toast.success("סומן כפורסם. כל הכבוד 🙂");
              })
            }
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-chip border text-sm font-medium transition-colors",
              current && step === "published" && "border-status-done bg-status-done text-white",
              current && step !== "published" && "border-ink bg-ink text-paper",
              !current && done && "border-rule bg-paper-deep text-ink-soft",
              !current && !done && "border-rule bg-surface text-ink hover:border-rule-strong",
            )}
          >
            {done && <IconCheck size={16} />}
            {STATUS_LABEL[step]}
          </button>
        );
      })}
    </div>
  );
}
