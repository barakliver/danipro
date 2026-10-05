import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Standard page frame: generous gutters, readable measure, header with optional actions. */
export function Page({
  title,
  lead,
  actions,
  children,
  width = "default",
  className,
}: {
  title?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto px-4 pt-6 sm:px-6 lg:pt-10",
        width === "narrow" && "max-w-2xl",
        width === "default" && "max-w-4xl",
        width === "wide" && "max-w-6xl",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 lg:mb-8">
          <div className="min-w-0">
            {title && <h1 className="font-display text-2xl font-medium text-ink lg:text-3xl">{title}</h1>}
            {lead && <p className="mt-1.5 max-w-prose text-sm text-graphite">{lead}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </main>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-rule-strong bg-surface/60 px-6 py-10 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-graphite">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
