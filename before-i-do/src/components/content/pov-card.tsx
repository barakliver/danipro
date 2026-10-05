import type { Pov } from "@/lib/domain/content-body";

/** How a POV reel will read on a phone: on-screen text over the shot description. */
export function PovCard({ pov, hook }: { pov?: Pov; hook?: string | null }) {
  const text = pov?.onScreenText || hook || "";
  return (
    <div className="relative flex aspect-[9/16] w-full flex-col overflow-hidden rounded-card bg-[#26262a] text-white">
      <div className="px-6 pt-14">
        <p className="font-sans text-[17px] font-semibold leading-snug [text-wrap:balance] [text-shadow:0_1px_8px_rgba(0,0,0,.4)]">{text || "טקסט על המסך"}</p>
      </div>
      <div className="mt-auto space-y-2 bg-gradient-to-t from-black/60 to-transparent px-6 pb-6 pt-16 text-sm text-white/85">
        {pov?.action && <p className="line-clamp-4 whitespace-pre-line">{pov.action}</p>}
        <p className="text-xs text-white/60">{[pov?.length, pov?.location].filter(Boolean).join(" | ")}</p>
      </div>
    </div>
  );
}
