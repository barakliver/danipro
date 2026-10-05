"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FILMED_FORMATS } from "@/lib/domain/constants";
import { documentsFor, hasGraphics, planFrames, type PlannedFrame } from "@/lib/render/plan";
import { canvasSize } from "@/lib/render/document";
import { CLIENT_FONT_CSS } from "@/lib/render/fonts";
import { FAMILY_LABEL, isTemplateFamily } from "@/lib/render/families";
import { deliverFiles, renderInBrowser } from "@/lib/render/client-export";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { IconDownload } from "@/components/ui/icons";
import { FramePreview } from "@/components/render/frame-preview";
import { CopyButton } from "@/components/content/copy-button";
import { captionText, storyText, slidesText } from "@/lib/content/copy-text";
import { useEditor } from "../editor-context";

export function VisualPanel() {
  const { draft } = useEditor();
  if (FILMED_FORMATS.has(draft.format)) return <FilmingBrief />;
  if (!hasGraphics(draft.format)) return <p className="text-sm text-graphite">לפורמט הזה אין עיצוב גרפי.</p>;
  return <DesignStudio />;
}

function useEditorFrames(guides: boolean) {
  const { draft, render, assetUrls } = useEditor();
  return useMemo(() => {
    const frames = planFrames(draft, render.templates, render.settings, (id) => assetUrls[id]?.preview);
    return { frames, docs: documentsFor(frames, CLIENT_FONT_CSS, guides) };
  }, [draft, render, assetUrls, guides]);
}

function DesignStudio() {
  const { draft, setField, render, recommendations, id, flush } = useEditor();
  const { frames, docs } = useEditorFrames(true);
  const [busy, setBusy] = useState<string | null>(null);
  const format = frames[0]?.input.format ?? (draft.format === "carousel" ? "carousel" : "story");
  const size = canvasSize(format);
  const templatesForFormat = render.templates.filter((t) => isTemplateFamily(t.family) && (format === "carousel" ? t.family !== "question" : t.family !== "carousel_editorial"));

  const exportFrames = async (targets: PlannedFrame[], label: string) => {
    setBusy(label);
    try {
      await flush();
      const files: File[] = [];
      for (const [i, frame] of targets.entries()) {
        const name = `before-i-do-${String(i + 1).padStart(2, "0")}.png`;
        const response = await fetch(`/api/export/${id}?frame=${encodeURIComponent(frame.key)}`, { cache: "no-store" });
        if (response.ok) {
          files.push(new File([await response.blob()], name, { type: "image/png" }));
        } else if (response.status === 501) {
          // no server renderer: render the identical document in the browser
          const [html] = documentsFor([frame], CLIENT_FONT_CSS, false);
          files.push(new File([await renderInBrowser(html, size)], name, { type: "image/png" }));
        } else {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "הייצוא נכשל");
        }
      }
      const result = await deliverFiles(files);
      if (result === "downloaded") toast.success(files.length > 1 ? `ירדו ${files.length} תמונות` : "התמונה ירדה");
      if (result === "shared") toast.success("נשמר");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הייצוא נכשל");
    } finally {
      setBusy(null);
    }
  };

  const copy = draft.format === "carousel" ? [slidesText(draft), captionText(draft)].filter(Boolean).join("\n\n") : storyText(draft) || draft.hook || "";

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="tpl-title">
        <h2 id="tpl-title" className="font-display text-xl">
          תבנית
        </h2>
        {recommendations.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {recommendations.map((rec) => {
              const tpl = render.templates.find((t) => t.id === rec.templateId);
              const selected = draft.template_id === rec.templateId;
              return (
                <li key={rec.templateId}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setField("template_id", selected ? null : rec.templateId)}
                    className={cn(
                      "flex h-full w-full flex-col items-start rounded-card border px-4 py-3 text-start transition-colors",
                      selected ? "border-ink bg-ink text-paper" : "border-rule bg-surface hover:border-rule-strong",
                    )}
                  >
                    <span className="text-[15px] font-medium">{tpl?.name ?? FAMILY_LABEL[rec.family]}</span>
                    <span className={cn("mt-0.5 text-xs", selected ? "text-paper/75" : "text-graphite")}>{rec.reason}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="all-templates" className="text-sm text-graphite">
            או תבנית אחרת:
          </label>
          <Select id="all-templates" className="max-w-60" value={draft.template_id ?? ""} onChange={(e) => setField("template_id", e.target.value || null)}>
            <option value="">אוטומטי לפי הפריים</option>
            {templatesForFormat.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section aria-labelledby="frames-preview-title">
        <div className="flex items-baseline justify-between">
          <h2 id="frames-preview-title" className="font-display text-xl">
            {format === "carousel" ? "הקרוסלה" : "הסטורי"}
          </h2>
          <span className="text-xs text-graphite" dir="ltr">
            {size.width}×{size.height}
          </span>
        </div>
        {frames.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-rule-strong p-5 text-sm text-graphite">אין עדיין טקסט לעצב. כותבים בלשונית תוכן, והעיצוב מופיע כאן.</p>
        ) : (
          <ul className={cn("mt-3 grid gap-3", format === "carousel" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
            {frames.map((frame, i) => (
              <li key={frame.key} className="flex flex-col gap-1.5">
                <FramePreview html={docs[i]} size={size} label={frame.label} />
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-graphite">{frame.label}</span>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => exportFrames([frame], frame.key)}
                    className="inline-flex h-9 items-center gap-1 rounded-chip px-2 text-xs font-medium text-pen hover:bg-pen-wash disabled:opacity-40"
                    aria-label={`הורדת ${frame.label}`}
                  >
                    <IconDownload size={15} />
                    {busy === frame.key ? "…" : "PNG"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-graphite">הקווים המקווקווים מסמנים את האזור שאינסטגרם מכסה ואת המקום לסקר. הם לא יופיעו בתמונה.</p>
      </section>

      {frames.length > 0 && (
        <div className="sticky bottom-24 z-10 -mx-1 flex flex-wrap gap-2 rounded-card border border-rule bg-surface/95 p-2 shadow-lift backdrop-blur lg:bottom-6">
          <Button variant="primary" size="lg" className="flex-1" pending={busy === "all"} onClick={() => exportFrames(frames, "all")}>
            <IconDownload size={18} />
            {busy === "all" ? "מכינה…" : frames.length > 1 ? `שמירת ${frames.length} התמונות` : "שמירת התמונה"}
          </Button>
          <CopyButton text={copy} label="העתק טקסט" size="lg" />
          <Button asChild size="lg" variant="ghost" className="hidden sm:inline-flex">
            <a href={`/api/export/${id}`} onClick={() => void flush()}>
              ZIP
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function FilmingBrief() {
  const { draft } = useEditor();
  const pov = draft.body.pov;
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-card border border-rule bg-surface p-5">
        <h2 className="font-display text-xl">מה מצלמים</h2>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{pov?.action || pov?.shot || draft.visual_notes || "עוד לא כתבנו מה עושים בפריים. אפשר להוסיף בלשונית תוכן."}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            ["אורך", pov?.length],
            ["לוקיישן", pov?.location || draft.location_category],
            ["סאונד", pov?.sound],
            ["מצלמה", pov?.cameraSetup],
            ["לבוש", pov?.outfit],
            ["אביזרים", pov?.props?.join(", ")],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-graphite">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
        </dl>
        {pov?.gameAppears && <p className="mt-4 text-sm text-ink">המשחק מופיע בפריים, קטן ובפרופורציות אמיתיות (בערך 12 על 8 ס״מ).</p>}
      </section>
      <Button asChild variant="quiet" size="lg" className="self-start">
        <Link href="/filming">להוסיף ליום צילום</Link>
      </Button>
    </div>
  );
}
