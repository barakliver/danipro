"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { GALLERY_TAG_SEEDS, LOCATION_CATEGORIES, FORMAT_LABEL, STATUS_LABEL, type ContentFormat, type ContentStatus } from "@/lib/domain/constants";
import { SMART_COLLECTIONS, matchesCollection, type GalleryAsset, type SmartCollection } from "@/lib/gallery/collections";
import { assetUsage, deleteAsset, updateAsset } from "@/lib/gallery/actions";
import { uploadToGallery, type UploadProgress } from "@/lib/gallery/upload-client";
import type { AssetUrls } from "@/lib/gallery/urls";
import { createContent } from "@/lib/content/actions";
import { formatDayShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { IconUpload } from "@/components/ui/icons";
import { EmptyState } from "@/components/shell/page";

const PEOPLE = ["אני", "ברק", "אנחנו", "זוג"];
const MOODS = ["רגוע", "מצחיק", "אישי", "ערב", "בוקר", "מבולגן", "חגיגי"];
const ORIENTATION_LABEL: Record<string, string> = { portrait: "לאורך", landscape: "לרוחב", square: "ריבוע" };

export function GalleryView({ assets, urls, tags, workspaceId }: { assets: GalleryAsset[]; urls: AssetUrls; tags: Array<{ name: string; kind: string }>; workspaceId: string }) {
  const [collection, setCollection] = useState<SmartCollection | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<GalleryAsset | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const tagNames = useMemo(() => {
    const used = new Set(assets.flatMap((a) => a.tags));
    return tags.map((t) => t.name).filter((n) => used.has(n));
  }, [assets, tags]);

  const shown = assets.filter(
    (a) =>
      (!collection || matchesCollection(a, collection)) &&
      (!tag || a.tags.includes(tag)) &&
      (!q.trim() || [a.notes, a.original_filename, a.mood, a.location_category, ...a.tags, ...a.people].some((v) => v?.includes(q.trim()))),
  );

  return (
    <main
      className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length) setPendingFiles(files);
      }}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium lg:text-3xl">גלריה</h1>
          <p className="mt-1 text-sm text-graphite">התמונות והסרטונים שלנו. פרטי לגמרי, רק לסטודיו.</p>
        </div>
        <UploadButton onPick={setPendingFiles} />
      </header>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="אוספים">
        <Chip size="sm" selected={!collection} onClick={() => setCollection(null)}>
          הכל ({assets.length})
        </Chip>
        {SMART_COLLECTIONS.map((c) => (
          <Chip key={c.key} size="sm" selected={collection === c.key} onClick={() => setCollection(collection === c.key ? null : c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input type="search" aria-label="חיפוש בגלריה" placeholder="חיפוש: תגית, מקום, הערה" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 max-w-xs" />
        {tagNames.length > 0 && (
          <div className="no-scrollbar flex w-full gap-1 overflow-x-auto sm:w-auto sm:flex-1" role="group" aria-label="תגיות">
            {tagNames.map((t) => (
              <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} className={cn("h-8 shrink-0 rounded-chip px-2.5 text-xs", tag === t ? "bg-highlight text-ink" : "text-graphite hover:bg-paper-deep")}>
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="הגלריה מחכה לתמונות אמיתיות" action={<UploadButton onPick={setPendingFiles} />}>
            צילומים מהטלפון, הקופסאות מבית הדפוס, שולחן תכנון מבולגן. כשיש כאן תמונות, הסטודיו ימליץ עליהן לפני כל דבר אחר.
          </EmptyState>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-sm text-graphite">אין תמונות שמתאימות לסינון.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6" aria-label="תמונות">
          {shown.map((asset) => (
            <li key={asset.id}>
              <button type="button" onClick={() => setOpen(asset)} className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[10px] bg-paper-deep" aria-label={`פרטים: ${asset.tags.join(", ") || asset.original_filename || "תמונה"}`}>
                {urls[asset.id]?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL, resized server-side
                  <img src={urls[asset.id]!.thumb!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                ) : (
                  <span className="flex h-full items-center justify-center p-2 text-center text-[11px] text-graphite">{asset.original_filename ?? "קובץ"}</span>
                )}
                {asset.media_type === "video" && <span className="absolute bottom-1 start-1 rounded-chip bg-ink/70 px-1.5 text-[10px] text-white">וידאו</span>}
                {asset.usageCount === 0 && <span className="absolute top-1 start-1 h-2 w-2 rounded-full bg-highlight ring-2 ring-white" title="עוד לא השתמשנו" />}
                {asset.worked_well && <span className="absolute top-1 end-1 rounded-chip bg-white/85 px-1.5 text-[10px] text-ink">עבד טוב</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <UploadSheet files={pendingFiles} workspaceId={workspaceId} onDone={() => setPendingFiles([])} />
      <AssetSheet asset={open} url={open ? (urls[open.id]?.preview ?? urls[open.id]?.thumb ?? null) : null} allTags={tags} onClose={() => setOpen(null)} />
    </main>
  );
}

function UploadButton({ onPick }: { onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*"
        className="sr-only"
        aria-label="העלאת תמונות וסרטונים"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPick(files);
          e.target.value = "";
        }}
      />
      <Button variant="primary" onClick={() => input.current?.click()}>
        <IconUpload size={18} />
        העלאה
      </Button>
    </>
  );
}

function UploadSheet({ files, workspaceId, onDone }: { files: File[]; workspaceId: string; onDone: () => void }) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (files.length) {
      setTags([]);
      setProgress(null);
    }
  }, [files]);

  const start = async () => {
    setBusy(true);
    const result = await uploadToGallery(files, workspaceId, { tags, onProgress: setProgress });
    setBusy(false);
    if (result.failed.length) toast.error(`${result.failed.length} קבצים לא עלו`, { description: result.failed.slice(0, 3).join("\n") });
    if (result.ids.length) toast.success(`${result.ids.length} עלו לגלריה`);
    router.refresh();
    onDone();
  };

  return (
    <Sheet open={files.length > 0} onOpenChange={(o) => !o && !busy && onDone()} title={`העלאת ${files.length} ${files.length === 1 ? "קובץ" : "קבצים"}`} description="אפשר לתייג עכשיו את כל ההעלאה, או אחר כך תמונה תמונה.">
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="תגיות לכל ההעלאה">
          {GALLERY_TAG_SEEDS.filter((t) => t.kind !== "format").map((t) => (
            <Chip key={t.name} size="sm" selected={tags.includes(t.name)} onClick={() => setTags((s) => (s.includes(t.name) ? s.filter((x) => x !== t.name) : [...s, t.name]))}>
              {t.name}
            </Chip>
          ))}
        </div>
        {progress && (
          <div>
            <div className="h-2 overflow-hidden rounded-chip bg-paper-deep" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full bg-pen transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-graphite">
              {progress.done} מתוך {progress.total}
            </p>
          </div>
        )}
        <Button variant="primary" size="lg" pending={busy} onClick={start}>
          {busy ? "מעלה…" : "להעלות"}
        </Button>
        <p className="text-xs text-graphite">הקבצים המקוריים נשמרים כמו שהם. התמונות נשארות פרטיות.</p>
      </div>
    </Sheet>
  );
}

function AssetSheet({ asset, url, allTags, onClose }: { asset: GalleryAsset | null; url: string | null; allTags: Array<{ name: string }>; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<GalleryAsset | null>(asset);
  const [newTag, setNewTag] = useState("");
  const [usage, setUsage] = useState<Array<{ id: string; title: string; format: string; status: string; published_at: string | null }> | null>(null);

  useEffect(() => {
    setDraft(asset);
    setUsage(null);
    if (asset) assetUsage(asset.id).then((r) => r.ok && setUsage(r.data));
  }, [asset]);

  if (!asset || !draft) return <Sheet open={false} onOpenChange={() => {}} title="">{null}</Sheet>;

  const toggle = (key: "tags" | "people" | "suitable_formats", value: string) =>
    setDraft((d) => (d ? { ...d, [key]: (d[key] as string[]).includes(value) ? (d[key] as string[]).filter((x) => x !== value) : [...(d[key] as string[]), value] } : d));

  const save = () =>
    startTransition(async () => {
      const result = await updateAsset(asset.id, {
        tags: draft.tags,
        people: draft.people,
        location_category: draft.location_category,
        mood: draft.mood,
        suitable_formats: draft.suitable_formats as Array<"story" | "carousel" | "post" | "reel">,
        notes: draft.notes,
        worked_well: draft.worked_well,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success("נשמר");
      router.refresh();
      onClose();
    });

  const tagOptions = Array.from(new Set([...allTags.map((t) => t.name), ...draft.tags]));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="פרטי תמונה" size="lg">
      <div className="grid gap-5 pb-2 md:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <div className="overflow-hidden rounded-card bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
            {url && <img src={url} alt="" className="w-full object-contain" />}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-graphite">כיוון</dt>
              <dd>{asset.orientation ? ORIENTATION_LABEL[asset.orientation] : "לא ידוע"}</dd>
            </div>
            <div>
              <dt className="text-graphite">תאריך</dt>
              <dd>{formatDayShort((asset.taken_at ?? asset.created_at).slice(0, 10))}</dd>
            </div>
            {asset.width && (
              <div>
                <dt className="text-graphite">גודל</dt>
                <dd dir="ltr" className="text-end">
                  {asset.width}×{asset.height}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-graphite">שימוש</dt>
              <dd>{asset.usageCount === 0 ? "עוד לא" : `${asset.usageCount} פעמים`}</dd>
            </div>
          </dl>
          <Button
            className="mt-3 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await createContent({ format: "story", body: { frames: [{ id: crypto.randomUUID(), kind: "photo", text: "", assetId: asset.id }] }, source: "manual" });
                if (!result.ok) return void toast.error(result.error);
                router.push(`/content/${result.data.id}`);
              })
            }
          >
            ליצור סטורי מהתמונה
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-soft">מי בתמונה</legend>
            <div className="flex flex-wrap gap-1.5">
              {PEOPLE.map((p) => (
                <Chip key={p} size="sm" selected={draft.people.includes(p)} onClick={() => toggle("people", p)}>
                  {p}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-soft">תגיות</legend>
            <div className="flex flex-wrap gap-1.5">
              {tagOptions.map((t) => (
                <Chip key={t} size="sm" selected={draft.tags.includes(t)} onClick={() => toggle("tags", t)}>
                  {t}
                </Chip>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = newTag.trim();
                if (t && !draft.tags.includes(t)) setDraft({ ...draft, tags: [...draft.tags, t] });
                setNewTag("");
              }}
            >
              <Input aria-label="תגית חדשה" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="תגית חדשה" className="h-10" />
              <Button type="submit" size="sm" disabled={!newTag.trim()}>
                הוספה
              </Button>
            </form>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field label="איפה">
              {(p) => (
                <Select {...p} value={draft.location_category ?? ""} onChange={(e) => setDraft({ ...draft, location_category: e.target.value || null })}>
                  <option value="">לא ידוע</option>
                  {LOCATION_CATEGORIES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="אווירה">
              {(p) => (
                <Select {...p} value={draft.mood ?? ""} onChange={(e) => setDraft({ ...draft, mood: e.target.value || null })}>
                  <option value="">בלי</option>
                  {MOODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-soft">מתאים ל</legend>
            <div className="flex flex-wrap gap-1.5">
              {(["story", "carousel", "post", "reel"] as const).map((f) => (
                <Chip key={f} size="sm" selected={draft.suitable_formats.includes(f)} onClick={() => toggle("suitable_formats", f)}>
                  {f === "story" ? "סטורי" : f === "carousel" ? "קרוסלה" : f === "post" ? "פוסט" : "ריל"}
                </Chip>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--color-pen)]" checked={draft.worked_well} onChange={(e) => setDraft({ ...draft, worked_well: e.target.checked })} />
            עבד טוב בעבר
          </label>
          <Field label="הערה">{(p) => <Textarea {...p} rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} />}</Field>

          <section aria-label="היסטוריית שימוש">
            <h3 className="text-sm font-medium text-ink-soft">איפה השתמשנו</h3>
            {usage === null ? (
              <p className="mt-1 text-xs text-graphite">טוענת…</p>
            ) : usage.length === 0 ? (
              <p className="mt-1 text-xs text-graphite">עוד לא השתמשנו בתמונה הזו.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {usage.map((u) => (
                  <li key={u.id}>
                    <Link href={`/content/${u.id}`} className="flex items-center gap-2 text-sm text-pen hover:underline">
                      <span className="truncate">{u.title}</span>
                      <Tag tone="muted">{FORMAT_LABEL[u.format as ContentFormat]}</Tag>
                      <Tag tone="muted">{STATUS_LABEL[u.status as ContentStatus]}</Tag>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
            <Button variant="primary" pending={pending} onClick={save}>
              שמירה
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!window.confirm("להסיר את התמונה מהגלריה?")) return;
                  const r = await deleteAsset(asset.id);
                  if (!r.ok) return void toast.error(r.error);
                  router.refresh();
                  onClose();
                })
              }
            >
              הסרה
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
