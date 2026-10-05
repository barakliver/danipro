import { FORMAT_LABEL, STATUS_LABEL, type ContentFormat, type ContentStatus } from "@/lib/domain/constants";
import { statusTone } from "@/lib/domain/status";
import type { Content } from "@/lib/content/types";
import { cn } from "@/lib/utils/cn";
import { Tag } from "@/components/ui/chip";

const TONE_DOT: Record<ReturnType<typeof statusTone>, string> = {
  draft: "bg-status-draft",
  progress: "bg-status-progress",
  ready: "bg-status-ready",
  done: "bg-status-done",
};

export function StatusPill({ status, className }: { status: ContentStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft", className)}>
      <span className={cn("h-2 w-2 rounded-full", TONE_DOT[statusTone(status)])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FormatTag({ format }: { format: ContentFormat }) {
  return <Tag tone="pen">{FORMAT_LABEL[format]}</Tag>;
}

export function PillarTag({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return <Tag>{name}</Tag>;
}

/** What a piece needs from real life: filming, the game, Barak, another couple. */
export function NeedsList({ item, compact = false }: { item: Pick<Content, "requires_filming" | "requires_product" | "requires_barak" | "requires_couple">; compact?: boolean }) {
  const needs = [
    item.requires_filming && { key: "film", label: "צילום", short: "🎥" },
    item.requires_product && { key: "product", label: "המשחק", short: "🃏" },
    item.requires_barak && { key: "barak", label: "ברק", short: "ב" },
    item.requires_couple && { key: "couple", label: "זוג נוסף", short: "זוג" },
  ].filter(Boolean) as Array<{ key: string; label: string; short: string }>;
  if (!needs.length) return null;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-graphite" aria-label={`צריך: ${needs.map((n) => n.label).join(", ")}`}>
        {needs.map((n) => (
          <span key={n.key} className="rounded-chip border border-rule px-1.5 leading-5" aria-hidden>
            {n.label}
          </span>
        ))}
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="מה צריך">
      {needs.map((n) => (
        <li key={n.key}>
          <Tag tone="highlight">{n.label}</Tag>
        </li>
      ))}
    </ul>
  );
}
