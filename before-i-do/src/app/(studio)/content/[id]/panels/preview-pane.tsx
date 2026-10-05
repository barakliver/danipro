"use client";

import { useMemo, useState } from "react";
import { FILMED_FORMATS } from "@/lib/domain/constants";
import { documentsFor, planFrames } from "@/lib/render/plan";
import { canvasSize } from "@/lib/render/document";
import { CLIENT_FONT_CSS } from "@/lib/render/fonts";
import { FramePreview } from "@/components/render/frame-preview";
import { PovCard } from "@/components/content/pov-card";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "../editor-context";

/** Live preview next to the editor (desktop). Phones see previews inside the Visual tab. */
export function PreviewPane() {
  const { draft, render, assetUrls } = useEditor();
  const [active, setActive] = useState(0);
  const { frames, docs } = useMemo(() => {
    const f = planFrames(draft, render.templates, render.settings, (id) => assetUrls[id]?.preview);
    return { frames: f, docs: documentsFor(f, CLIENT_FONT_CSS, true) };
  }, [draft, render, assetUrls]);

  if (FILMED_FORMATS.has(draft.format)) return <PovCard pov={draft.body.pov} hook={draft.hook} />;
  if (!frames.length) return <div className="flex aspect-[9/16] items-center justify-center rounded-card border border-dashed border-rule-strong text-sm text-graphite">התצוגה תופיע כאן</div>;

  const index = Math.min(active, frames.length - 1);
  const size = canvasSize(frames[0].input.format);
  return (
    <div>
      <FramePreview html={docs[index]} size={size} label={frames[index].label} />
      {frames.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="פריימים">
          {frames.map((f, i) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={f.label}
              onClick={() => setActive(i)}
              className={cn("h-2.5 rounded-chip transition-all", i === index ? "w-6 bg-ink" : "w-2.5 bg-rule-strong")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
