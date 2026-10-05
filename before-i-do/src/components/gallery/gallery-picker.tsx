"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { pickerGallery } from "@/lib/gallery/actions";
import type { GalleryAsset, SmartCollection } from "@/lib/gallery/queries";
import type { AssetUrls } from "@/lib/gallery/urls";
import { Sheet } from "@/components/ui/sheet";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils/cn";

const PICKER_COLLECTIONS: Array<{ key: SmartCollection | "all"; label: string }> = [
  { key: "all", label: "הכל" },
  { key: "story", label: "לסטורי" },
  { key: "carousel", label: "לקרוסלה" },
  { key: "game", label: "עם המשחק" },
  { key: "barak", label: "עם ברק" },
  { key: "unused", label: "עוד לא השתמשנו" },
  { key: "worked", label: "עבד טוב" },
];

/** Choose a real photo from the private Gallery. Recommended photos (if any) come first. */
export function GalleryPicker({
  open,
  onOpenChange,
  onPick,
  recommendedIds = [],
  initialCollection = "all",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: GalleryAsset, urls: AssetUrls) => void;
  recommendedIds?: string[];
  initialCollection?: SmartCollection | "all";
}) {
  const [collection, setCollection] = useState<SmartCollection | "all">(initialCollection);
  const [data, setData] = useState<{ assets: GalleryAsset[]; urls: AssetUrls } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await pickerGallery(collection === "all" ? {} : { collection });
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else setError(result.error);
    });
  }, [open, collection]);

  const assets = data?.assets ?? [];
  const rank = new Map(recommendedIds.map((id, i) => [id, i]));
  const sorted = [...assets].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="תמונה מהגלריה" description="תמונות אמיתיות שלנו. בלי סטוק." size="lg">
      <div className="no-scrollbar -mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 md:-mx-6 md:px-6" role="group" aria-label="אוספים">
        {PICKER_COLLECTIONS.map((c) => (
          <Chip key={c.key} size="sm" selected={collection === c.key} onClick={() => setCollection(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {pending && !data && <p className="py-10 text-center text-sm text-graphite">טוענת את הגלריה…</p>}
      {data && sorted.length === 0 && (
        <div className="py-10 text-center">
          <p className="font-display text-lg">אין כאן תמונות עדיין.</p>
          <p className="mt-1 text-sm text-graphite">מעלים מהטלפון בגלריה, ואז הן מופיעות כאן.</p>
          <Link href="/gallery" className="mt-4 inline-block text-sm font-medium text-pen underline">
            לגלריה
          </Link>
        </div>
      )}
      <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", pending && "opacity-60")}>
        {sorted.map((asset) => {
          const url = data?.urls[asset.id]?.thumb;
          const recommended = rank.has(asset.id);
          return (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(asset, data!.urls);
                  onOpenChange(false);
                }}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[12px] bg-paper-deep focus-visible:outline-offset-2"
                aria-label={`לבחור ${asset.tags.join(", ") || asset.original_filename || "תמונה"}`}
              >
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL, already resized
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                )}
                {asset.media_type === "video" && <span className="absolute bottom-1.5 start-1.5 rounded-chip bg-ink/70 px-2 text-[11px] text-white">וידאו</span>}
                {recommended && <span className="absolute top-1.5 start-1.5 rounded-chip bg-highlight px-2 text-[11px] font-medium text-ink">מתאים</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
