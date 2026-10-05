"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { collectCopy } from "@/lib/domain/content-body";
import { FEEDBACK_LABEL, REWRITE_FEEDBACK, type FeedbackKind } from "@/lib/domain/constants";
import { scoreTone, scoreVoice } from "@/lib/voice/score";
import { recordFeedback } from "@/lib/voice/actions";
import { rewriteContent } from "@/lib/ai/actions";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "../editor-context";

const TONE_STYLE = {
  strong: "border-status-done/30 text-status-done",
  ok: "border-status-progress/30 text-status-progress",
  weak: "border-danger/30 text-danger",
} as const;

/** Discreet "Sounds Like Us" score with the reasons behind it and the feedback buttons. */
export function VoicePanel() {
  const { draft, avoidWords, id, flush } = useEditor();
  const router = useRouter();
  const deferred = useDeferredValue(draft);
  const result = useMemo(
    () =>
      scoreVoice(collectCopy({ hook: deferred.hook, caption: deferred.caption, cta: deferred.cta, body: deferred.body }), {
        avoid: avoidWords,
        productIntent: deferred.product_presence as "none" | "natural" | "direct",
      }),
    [deferred, avoidWords],
  );
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const tone = scoreTone(result.score);
  const copyText = collectCopy({ hook: draft.hook, caption: draft.caption, cta: draft.cta, body: draft.body }).join("\n");

  const send = (kind: FeedbackKind) =>
    startTransition(async () => {
      await recordFeedback({ contentId: id, kind, text: copyText });
      if (kind === "this_is_us") return void toast.success("נשמר. נזכור שזה אנחנו.");
      if (kind === "not_us") return void toast("נשמר. ננסה להתרחק מזה בפעם הבאה.");
      await flush();
      const rewrite = await rewriteContent(id, kind);
      if (rewrite.ok) {
        toast.success("נכתבה גרסה חדשה. הקודמת שמורה בהיסטוריה.");
        router.refresh();
      } else {
        toast(rewrite.error, { description: rewrite.needsProvider ? "ההערה נשמרה. כשיחובר מנוע כתיבה הוא ישתמש בה." : undefined });
      }
    });

  return (
    <section aria-label="נשמע כמו אנחנו" className="rounded-card border border-rule bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
      >
        <span className={cn("inline-flex h-10 min-w-10 items-center justify-center rounded-chip border px-2 font-display text-lg tabular-nums", TONE_STYLE[tone])}>
          {result.score}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">נשמע כמו אנחנו</span>
          <span className="block truncate text-xs text-graphite">
            {result.flags[0]?.message ?? (tone === "strong" ? "נשמע כמו משהו שהיינו שולחים בוואטסאפ" : "אפשר להיות עוד יותר ספציפיים")}
          </span>
        </span>
        <span className="text-xs text-graphite">{open ? "לסגור" : "למה?"}</span>
      </button>

      {open && (
        <div className="border-t border-rule px-4 pb-4 pt-3">
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {result.dimensions.map((d) => (
              <li key={d.key} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 text-ink-soft">{d.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-chip bg-paper-deep" aria-hidden>
                  <span className={cn("block h-full rounded-chip", d.value >= 70 ? "bg-status-done" : d.value >= 50 ? "bg-status-progress" : "bg-danger")} style={{ width: `${d.value}%` }} />
                </span>
                <span className="w-7 text-end tabular-nums text-graphite">{d.value}</span>
              </li>
            ))}
          </ul>
          {result.flags.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {result.flags.map((f) => (
                <li key={f.code} className="rounded-field bg-paper px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{f.message}</span> <span className="text-graphite">{f.suggestion}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-mist">הערכה מקומית לפי הכללים ב־Brand Brain. היא כלי עזר, לא שופטת.</p>
        </div>
      )}

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-rule px-4 py-3" role="group" aria-label="משוב">
        <FeedbackChip disabled={pending} onClick={() => send("this_is_us")} strong>
          {FEEDBACK_LABEL.this_is_us}
        </FeedbackChip>
        <FeedbackChip disabled={pending} onClick={() => send("not_us")}>
          {FEEDBACK_LABEL.not_us}
        </FeedbackChip>
        <span className="mx-1 w-px shrink-0 bg-rule" aria-hidden />
        {REWRITE_FEEDBACK.map((kind) => (
          <FeedbackChip key={kind} disabled={pending} onClick={() => send(kind)}>
            {FEEDBACK_LABEL[kind]}
          </FeedbackChip>
        ))}
      </div>
    </section>
  );
}

function FeedbackChip({ children, strong, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { strong?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-9 shrink-0 rounded-chip border px-3 text-sm transition-colors disabled:opacity-50",
        strong ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink-soft hover:border-rule-strong hover:text-ink",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
