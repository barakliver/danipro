"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BRAND_SECTIONS, type BrandSectionKey } from "@/lib/brand/sections";
import { addBrandEntry, deleteBrandEntry, updateBrandEntry } from "@/lib/brand/actions";
import { AUDIENCE_SOURCE_LABEL, type AudienceSourceType } from "@/lib/domain/constants";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { IconTrash } from "@/components/ui/icons";

type Entry = { id: string; section: string; title: string | null; body: string; meta: Json; pinned: boolean; sort_order: number };

export function BrandView({ entries, audience, liked }: { entries: Entry[]; audience: Array<{ id: string; original_text: string; source_type: string }>; liked: Array<{ id: string; title: string }> }) {
  const bySection = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!bySection.has(e.section)) bySection.set(e.section, []);
    bySection.get(e.section)!.push(e);
  }
  const permanent = bySection.get("permanent_rules") ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">Brand Brain</h1>
      <p className="mt-1 text-sm text-graphite">כל מה שהסטודיו יודע עלינו. כל מה שנכתב כאן משפיע על כל טקסט שנוצר ועל הבדיקה &quot;נשמע כמו אנחנו&quot;.</p>

      {permanent[0] && (
        <aside className="mt-6 rounded-card bg-ink p-5 text-paper sm:p-6" aria-label="ההוראה הקבועה">
          <p className="whitespace-pre-line font-display text-xl leading-relaxed">{permanent[0].body}</p>
        </aside>
      )}

      <nav aria-label="חלקים" className="no-scrollbar sticky top-0 z-10 -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        {BRAND_SECTIONS.map((s) => (
          <a key={s.key} href={`#${s.key}`} className="h-9 shrink-0 rounded-chip px-3 text-sm leading-9 text-ink-soft hover:bg-paper-deep">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-10 pb-10">
        {BRAND_SECTIONS.map((section) => (
          <Section key={section.key} sectionKey={section.key} label={section.label} hint={section.hint} entries={bySection.get(section.key) ?? []}>
            {section.key === "audience_language" && audience.length > 0 && (
              <ul className="mb-3 flex flex-col gap-2">
                {audience.map((a) => (
                  <li key={a.id} className="rounded-field border-s-4 border-highlight bg-surface px-4 py-2 text-[15px]">
                    &quot;{a.original_text}&quot;
                    <span className="ms-2 text-xs text-graphite">{AUDIENCE_SOURCE_LABEL[a.source_type as AudienceSourceType]}</span>
                  </li>
                ))}
                <li>
                  <Link href="/audience" className="text-sm font-medium text-pen">
                    לכל שפת הקהל
                  </Link>
                </li>
              </ul>
            )}
            {section.key === "successful_content" && liked.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {liked.map((c) => (
                  <li key={c.id}>
                    <Link href={`/content/${c.id}`} className="text-[15px] text-pen hover:underline">
                      {c.title}
                    </Link>
                    <span className="ms-2 text-xs text-graphite">סומן &quot;זה אנחנו&quot;</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
      </div>
    </main>
  );
}

function Section({ sectionKey, label, hint, entries, children }: { sectionKey: BrandSectionKey; label: string; hint: string; entries: Entry[]; children?: React.ReactNode }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const isExamples = sectionKey === "good_examples" || sectionKey === "bad_examples";

  return (
    <section id={sectionKey} aria-labelledby={`${sectionKey}-title`} className="scroll-mt-16">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`${sectionKey}-title`} className={cn("font-display text-xl", sectionKey === "bad_examples" && "text-graphite")}>
            {label}
          </h2>
          {hint && <p className="text-xs text-graphite">{hint}</p>}
        </div>
        <button type="button" className="shrink-0 text-sm font-medium text-pen" onClick={() => setAdding(true)}>
          הוספה
        </button>
      </div>
      {children}
      {entries.length === 0 && !adding && !children && <p className="text-sm text-mist">ריק בינתיים.</p>}
      <ul className={cn("flex flex-col gap-2", isExamples && "sm:grid sm:grid-cols-2")}>
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} tone={sectionKey === "bad_examples" ? "bad" : sectionKey === "good_examples" ? "good" : "plain"} />
        ))}
      </ul>
      {adding && (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await addBrandEntry({ section: sectionKey, body: text });
              if (!result.ok) return void toast.error(result.error);
              setText("");
              setAdding(false);
              router.refresh();
            });
          }}
        >
          <Textarea autoFocus aria-label={`הוספה ל${label}`} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={isExamples ? "משפט אחד, בדיוק כמו שהוא" : "מה חשוב לזכור?"} />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" pending={pending} disabled={!text.trim()}>
              שמירה
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              ביטול
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function EntryCard({ entry, tone }: { entry: Entry; tone: "good" | "bad" | "plain" }) {
  const router = useRouter();
  const [body, setBody] = useState(entry.body);
  const [saved, setSaved] = useState(entry.body);
  const [pending, startTransition] = useTransition();
  const avoid = typeof entry.meta === "object" && entry.meta && !Array.isArray(entry.meta) ? (entry.meta as Record<string, unknown>).avoid : undefined;

  return (
    <li className={cn("group rounded-card border bg-surface p-3", tone === "bad" ? "border-dashed border-rule-strong" : "border-rule")}>
      {entry.title && <p className="mb-1 text-xs font-medium text-graphite">{entry.title}</p>}
      <Textarea
        aria-label={entry.title ?? "רשומה"}
        rows={1}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => {
          if (body.trim() === saved.trim() || !body.trim()) return;
          startTransition(async () => {
            const result = await updateBrandEntry(entry.id, { body });
            if (result.ok) {
              setSaved(body);
              toast.success("נשמר");
            } else toast.error(result.error);
          });
        }}
        className={cn("border-transparent bg-transparent px-1 py-1 hover:border-rule focus:bg-surface", tone === "good" && "font-display text-lg", tone === "bad" && "text-graphite line-through decoration-rule-strong")}
      />
      {typeof avoid === "string" && avoid && <p className="mt-1 px-1 text-xs text-graphite">להימנע: {avoid}</p>}
      <div className="mt-1 flex justify-end opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          disabled={pending}
          aria-label="מחיקה"
          className="inline-flex h-9 w-9 items-center justify-center rounded-chip text-graphite hover:bg-paper-deep"
          onClick={() =>
            startTransition(async () => {
              if (!window.confirm("למחוק?")) return;
              const result = await deleteBrandEntry(entry.id);
              if (!result.ok) toast.error(result.error);
              router.refresh();
            })
          }
        >
          <IconTrash size={16} />
        </button>
      </div>
    </li>
  );
}
