"use client";

import { useState } from "react";
import { GalleryPicker } from "@/components/gallery/gallery-picker";
import { IconImage } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "../editor-context";

/** A frame's photo: shows the chosen Gallery image, or a button to choose one. */
export function PhotoSlot({ assetId, onChange, className }: { assetId?: string; onChange: (assetId: string | undefined) => void; className?: string }) {
  const { assetUrls, addAssetUrls } = useEditor();
  const [open, setOpen] = useState(false);
  const url = assetId ? assetUrls[assetId]?.thumb : null;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {assetId ? (
        <>
          <button type="button" onClick={() => setOpen(true)} className="h-20 w-16 shrink-0 overflow-hidden rounded-[10px] bg-paper-deep" aria-label="להחליף תמונה">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
            {url && <img src={url} alt="" className="h-full w-full object-cover" />}
          </button>
          <div className="flex flex-col items-start gap-1">
            <button type="button" className="text-sm font-medium text-pen" onClick={() => setOpen(true)}>
              להחליף תמונה
            </button>
            <button type="button" className="text-sm text-graphite" onClick={() => onChange(undefined)}>
              להסיר
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-chip border border-dashed border-rule-strong px-4 text-sm font-medium text-ink-soft hover:border-ink">
          <IconImage size={18} />
          לבחור תמונה מהגלריה
        </button>
      )}
      <GalleryPicker
        open={open}
        onOpenChange={setOpen}
        onPick={(asset, urls) => {
          addAssetUrls({ [asset.id]: urls[asset.id] });
          onChange(asset.id);
        }}
      />
    </div>
  );
}
