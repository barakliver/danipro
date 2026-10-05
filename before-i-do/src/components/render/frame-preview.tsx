"use client";

import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shows a renderer document at any on-screen width by scaling a full-size iframe.
 * The iframe is sandboxed without scripts (same-origin only so it can load the app fonts)
 * and only ever receives escaped template HTML.
 */
export const FramePreview = memo(function FramePreview({
  html,
  size,
  className,
  label,
  rounded = true,
}: {
  html: string;
  size: { width: number; height: number };
  className?: string;
  label: string;
  rounded?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / size.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [size.width]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={cn("relative w-full overflow-hidden bg-paper-deep", rounded && "rounded-[calc(var(--radius-card)*0.8)]", className)}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      {scale > 0 && (
        <iframe
          title={label}
          srcDoc={html}
          sandbox="allow-same-origin"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute start-0 top-0 origin-top-right border-0"
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
});
