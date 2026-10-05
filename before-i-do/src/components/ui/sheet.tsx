"use client";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Bottom sheet on phones, centered panel on wider screens.
 * Radix handles focus trapping, Escape and aria wiring.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  size = "md",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-sheet bg-surface shadow-sheet outline-none",
            "data-[state=open]:animate-[sheet-up_260ms_var(--ease-out-soft)]",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:data-[state=open]:animate-[fade-in_160ms_ease-out]",
            size === "md" ? "md:w-[min(560px,92vw)]" : "md:w-[min(860px,94vw)]",
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-chip bg-rule md:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 md:px-6 md:pt-6">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-xl font-medium text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-graphite">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-chip text-graphite hover:bg-paper-deep"
              aria-label="סגירה"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 md:px-6">{children}</div>
          {footer && <div className="safe-bottom border-t border-rule px-5 pt-3 md:px-6 md:pb-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
