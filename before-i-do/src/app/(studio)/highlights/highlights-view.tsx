"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addHighlightItem, deleteHighlightItem, highlightToStory, reorderHighlightItems, updateHighlightItem } from "@/lib/highlights/actions";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { IconArrowDown, IconArrowUp, IconTrash } from "@/components/ui/icons";

type Item = { id: string; position: number; body: string; visual_notes: string | null; interaction: string | null; content_id: string | null };
export type Collection = { id: string; key: string; title: string; purpose: string | null; items: Item[] };

/** What a product highlight should eventually answer, and how to tell it's there. */
const PRODUCT_COVERAGE: Array<[string, RegExp]> = [
  ["מה זה", /מה זה|משחק|קלפ/],
  ["איך משחקים", /איך משחק|שולפ|קלף אחד|תור/],
  ["למי זה מתאים", /למי|מאורס|זוגות/],
  ["תמונות אמיתיות", /תמונה|צילום|תמונות/],
  ["תגובות של זוגות", /תגובה|תגובות|כתבו לנו|אמרו לנו/],
  ["איך מזמינים", /להזמין|הזמנה|מחיר|₪/],
  ["משלוח", /משלוח|איסוף|מגיע/],
  ["קישור", /קישור|לינק|ביו|link/i],
];

export function HighlightsView({ collections }: { collections: Collection[] }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">היילייטס</h1>
      <p className="mt-1 text-sm text-graphite">מה שנשאר בפרופיל אחרי שהסטורי נעלם. מידע על המוצר גר בעיקר כאן, ב&quot;המשחק&quot;.</p>

      <nav aria-label="היילייטס" className="mt-6 flex gap-5">
        {collections.map((c) => (
          <a key={c.id} href={`#${c.key}`} className="group flex w-20 flex-col items-center gap-1.5 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink/80 bg-surface p-1 transition-colors group-hover:border-pen">
              <span className="flex h-full w-full items-center justify-center rounded-full bg-paper-deep font-display text-sm leading-tight">{c.items.length}</span>
            </span>
            <span className="text-xs leading-tight">{c.title}</span>
          </a>
        ))}
      </nav>

      <div className="mt-8 flex flex-col gap-12">
        {collections.map((c) => (
          <CollectionSection key={c.id} collection={c} />
        ))}
      </div>
    </main>
  );
}

function CollectionSection({ collection }: { collection: Collection }) {
  const router = useRouter();
  const [items, setItems] = useState(collection.items);
  const [adding, setAdding] = useState("");
  const [pending, startTransition] = useTransition();
  // keep local order in sync after server refreshes
  const [seen, setSeen] = useState(collection.items);
  if (seen !== collection.items) {
    setSeen(collection.items);
    setItems(collection.items);
  }

  const move = (index: number, delta: -1 | 1) => {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setItems(next);
    startTransition(async () => {
      const result = await reorderHighlightItems(collection.id, next.map((i) => i.id));
      if (!result.ok) toast.error(result.error);
    });
  };

  const coverage = collection.key === "the_game" ? PRODUCT_COVERAGE.map(([label, re]) => ({ label, done: items.some((i) => re.test([i.body, i.visual_notes, i.interaction].join(" "))) })) : null;

  return (
    <section id={collection.key} aria-labelledby={`${collection.key}-title`} className="scroll-mt-6">
      <h2 id={`${collection.key}-title`} className="font-display text-xl">
        {collection.title}
      </h2>
      {collection.purpose && <p className="mt-0.5 text-sm text-graphite">{collection.purpose}</p>}

      {coverage && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="מה כבר מכוסה">
          {coverage.map((c) => (
            <li key={c.label} className={cn("rounded-chip px-2.5 py-1 text-xs", c.done ? "bg-highlight-soft text-ink" : "border border-dashed border-rule-strong text-graphite")}>
              {c.done ? "✓ " : ""}
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {items.length ? (
        <ol className="mt-4 flex flex-col gap-3">
          {items.map((item, index) => (
            <ItemCard key={item.id} item={item} index={index} last={index === items.length - 1} onMove={move} />
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-mist">עוד ריק.</p>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await addHighlightItem(collection.id, adding);
            if (!result.ok) return void toast.error(result.error);
            setAdding("");
            router.refresh();
          });
        }}
      >
        <Input aria-label={`סטורי חדש ב${collection.title}`} placeholder="עוד סטורי להיילייט" value={adding} onChange={(e) => setAdding(e.target.value)} className="flex-1" />
        <Button type="submit" pending={pending} disabled={!adding.trim()}>
          הוספה
        </Button>
      </form>
    </section>
  );
}

function ItemCard({ item, index, last, onMove }: { item: Item; index: number; last: boolean; onMove: (index: number, delta: -1 | 1) => void }) {
  const router = useRouter();
  const [body, setBody] = useState(item.body);
  const [visual, setVisual] = useState(item.visual_notes ?? "");
  const [interaction, setInteraction] = useState(item.interaction ?? "");
  const [busy, startTransition] = useTransition();

  const save = (patch: Parameters<typeof updateHighlightItem>[1]) =>
    startTransition(async () => {
      const result = await updateHighlightItem(item.id, patch);
      if (!result.ok) toast.error(result.error);
    });

  return (
    <li className="rounded-card border border-rule bg-surface p-3 sm:p-4">
      <div className="flex gap-3">
        <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-deep text-xs tabular-nums text-ink-soft">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <Textarea
            aria-label={`סטורי ${index + 1}`}
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => body.trim() && body !== item.body && save({ body })}
            className="min-h-0 resize-none border-transparent bg-transparent px-1 font-display text-lg [field-sizing:content] hover:border-rule focus:bg-surface"
          />
          <details className="mt-1 px-1">
            <summary className="cursor-pointer truncate text-xs text-graphite">{[visual, interaction].filter(Boolean).join(" · ") || "ויזואל ואינטראקציה"}</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-soft">מה רואים</span>
                <Input value={visual} onChange={(e) => setVisual(e.target.value)} onBlur={() => visual !== (item.visual_notes ?? "") && save({ visual_notes: visual || null })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-soft">סקר / שאלה</span>
                <Input value={interaction} onChange={(e) => setInteraction(e.target.value)} onBlur={() => interaction !== (item.interaction ?? "") && save({ interaction: interaction || null })} />
              </label>
            </div>
          </details>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 ps-10">
        {item.content_id ? (
          <Link href={`/content/${item.content_id}`} className="me-auto text-sm font-medium text-pen">
            לסטורי בעורך
          </Link>
        ) : (
          <button
            type="button"
            className="me-auto text-sm font-medium text-pen disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const result = await highlightToStory(item.id);
                if (!result.ok) return void toast.error(result.error);
                router.push(`/content/${result.data.contentId}`);
              })
            }
          >
            צור סטורי
          </button>
        )}
        <IconButton label="למעלה" disabled={index === 0} onClick={() => onMove(index, -1)}>
          <IconArrowUp size={16} />
        </IconButton>
        <IconButton label="למטה" disabled={last} onClick={() => onMove(index, 1)}>
          <IconArrowDown size={16} />
        </IconButton>
        <IconButton
          label="מחיקה"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("למחוק מההיילייט?")) return;
            startTransition(async () => {
              const result = await deleteHighlightItem(item.id);
              if (!result.ok) toast.error(result.error);
              router.refresh();
            });
          }}
        >
          <IconTrash size={16} />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-chip text-graphite hover:bg-paper-deep disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}
