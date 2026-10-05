import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; size?: "sm" | "md" };

/** Toggleable pill. Announces state with aria-pressed. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-chip border font-medium transition-colors duration-150",
        size === "md" ? "h-10 px-3.5 text-sm" : "h-8 px-3 text-xs",
        selected
          ? "border-ink bg-ink text-paper"
          : "border-rule bg-surface text-ink-soft hover:border-rule-strong hover:text-ink",
        className,
      )}
      {...props}
    />
  );
});

/** Non-interactive label. */
export function Tag({ className, tone = "plain", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "plain" | "pen" | "highlight" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-chip px-2.5 py-0.5 text-xs font-medium",
        tone === "plain" && "bg-paper-deep text-ink-soft",
        tone === "pen" && "bg-pen-wash text-pen-deep",
        tone === "highlight" && "bg-highlight-soft text-ink",
        tone === "muted" && "text-graphite",
        className,
      )}
      {...props}
    />
  );
}
