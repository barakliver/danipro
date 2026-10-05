import { cn } from "@/lib/utils/cn";

/** The studio's wordmark: the brand name in Frank Ruhl, a small highlighter tick under "I". */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span dir="ltr" className={cn("inline-flex flex-col leading-none", className)}>
      <span className={cn("font-display font-medium tracking-[-0.01em] text-ink", size === "lg" ? "text-4xl" : "text-xl")}>
        Before <span className="highlighted">I</span> Do
      </span>
      <span className={cn("mt-1 font-sans text-graphite", size === "lg" ? "text-sm" : "text-[11px]")} dir="rtl">
        סטודיו תוכן
      </span>
    </span>
  );
}
