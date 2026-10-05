"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { duplicateTemplate, updateTemplate } from "@/lib/templates/actions";
import { canvasSize, renderDocument, type RenderFormat, type RenderFrame } from "@/lib/render/document";
import type { DesignSettings } from "@/lib/render/design-settings";
import { FAMILY_LABEL, isTemplateFamily, PHOTO_FAMILIES, type TemplateFamily } from "@/lib/render/families";
import { CLIENT_FONT_CSS } from "@/lib/render/fonts";
import type { Json } from "@/lib/supabase/database.types";
import { formatDayShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { FramePreview } from "@/components/render/frame-preview";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Input, Select, Textarea } from "@/components/ui/field";
import { IconStar } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";

type Template = {
  id: string;
  family: string;
  name: string;
  formats: string[];
  best_use: string | null;
  config: Json;
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
  archived_at: string | null;
};
type Config = Record<string, unknown>;
const asConfig = (value: Json): Config => (value && typeof value === "object" && !Array.isArray(value) ? (value as Config) : {});

/** Sample copy in our own voice, so a preview shows how the family really reads. */
const SAMPLE: Record<TemplateFamily, RenderFrame> = {
  text_message: { kind: "text", text: "אמא שלו רוצה להוסיף עוד 40 מוזמנים.\nאת לא מכירה אף אחד מהם." },
  real_photo: { kind: "photo", text: "השבוע מגיעות הקופסאות הראשונות מבית הדפוס." },
  notes: { kind: "text", text: "מה זה 'חתונה קטנה'\nמה זה 'לא להשתגע עם התקציב'\nכמה ההורים מעורבים" },
  conversation: { kind: "text", text: "נעשה משהו קטן\n350 איש זה קטן" },
  question: { kind: "poll", text: "מה עושים?", options: ["מוסיפים", "מדברים שוב"] },
  product_in_life: { kind: "product", text: "ערב רגיל. שאלה אחת שלא תכננו." },
  carousel_editorial: { kind: "slide", text: "6 דברים ששניכם בטוחים שאתם מסכימים עליהם\nעד שמתחילים לתכנן חתונה", role: "cover", index: 0, total: 7 },
};

type Filter = "active" | "favorites" | "archived";

export function TemplatesView({ templates, settings, photoUrl }: { templates: Template[]; settings: DesignSettings; photoUrl: string | null }) {
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<Template | null>(null);
  const shown = templates.filter((t) => (filter === "archived" ? t.archived_at : !t.archived_at && (filter === "active" || t.is_favorite)));

  return (
    <main className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">תבניות</h1>
      <p className="mt-1 max-w-prose text-sm text-graphite">משפחות של עיצוב, לא תבנית אחת קבועה. כשנוצר תוכן, הסטודיו מציע 2–3 שמתאימות ולא חוזר על אותה אחת כל פעם.</p>

      <div className="mt-5 flex gap-1.5">
        {(
          [
            ["active", "בשימוש"],
            ["favorites", "מועדפות"],
            ["archived", "בארכיון"],
          ] as const
        ).map(([key, label]) => (
          <Chip key={key} size="sm" selected={filter === key} onClick={() => setFilter(key)}>
            {label}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-sm text-graphite">{filter === "favorites" ? "עוד לא סימנת מועדפות. הכוכב בכל כרטיס." : "אין כאן כלום."}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((t) => (
            <TemplateCard key={t.id} template={t} settings={settings} photoUrl={photoUrl} onEdit={() => setEditing(t)} />
          ))}
        </ul>
      )}

      {editing && <EditSheet template={editing} settings={settings} photoUrl={photoUrl} onClose={() => setEditing(null)} />}
    </main>
  );
}

function previewHtml(family: TemplateFamily, format: RenderFormat, config: Config, settings: DesignSettings, photoUrl: string | null) {
  const frame = format === "carousel" && family !== "carousel_editorial" ? { ...SAMPLE[family], kind: "slide" as const, role: "body" as const, index: 2, total: 7 } : SAMPLE[family];
  return renderDocument({ format, family, frame, settings, config, imageUrl: PHOTO_FAMILIES.has(family) ? photoUrl : null, fontCss: CLIENT_FONT_CSS });
}

function TemplateCard({ template, settings, photoUrl, onEdit }: { template: Template; settings: DesignSettings; photoUrl: string | null; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const family = isTemplateFamily(template.family) ? template.family : "text_message";
  const format: RenderFormat = template.formats.includes("story") ? "story" : "carousel";
  const config = asConfig(template.config);
  const html = useMemo(() => previewHtml(family, format, config, settings, photoUrl), [family, format, config, settings, photoUrl]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? "משהו השתבש");
      if (done) toast.success(done);
      router.refresh();
    });

  return (
    <li className={cn("flex flex-col", template.archived_at && "opacity-60")}>
      <div className="relative">
        <button type="button" onClick={onEdit} className="block w-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen" aria-label={`עריכת ${template.name}`}>
          <FramePreview html={html} size={canvasSize(format)} label={`תצוגה של ${template.name}`} className="shadow-sm" />
        </button>
        <button
          type="button"
          aria-pressed={template.is_favorite}
          aria-label={template.is_favorite ? "הסרה מהמועדפות" : "סימון כמועדפת"}
          disabled={pending}
          onClick={() => run(() => updateTemplate(template.id, { is_favorite: !template.is_favorite }))}
          className="absolute top-2 end-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur"
        >
          <IconStar size={18} filled={template.is_favorite} />
        </button>
      </div>
      <p className="mt-2.5 text-[15px] font-medium leading-tight">{template.name}</p>
      <p className="mt-0.5 text-xs text-graphite">
        {FAMILY_LABEL[family]} · {template.formats.map((f) => (f === "story" ? "סטורי" : "קרוסלה")).join(" / ")}
      </p>
      {template.best_use && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{template.best_use}</p>}
      <p className="mt-1 text-xs text-mist">{template.usage_count ? `פורסם ${template.usage_count} פעמים · אחרון ${template.last_used_at ? formatDayShort(template.last_used_at.slice(0, 10)) : ""}` : "עוד לא פורסם"}</p>
      <div className="mt-1.5 flex gap-3 text-xs font-medium">
        <button type="button" className="text-pen" onClick={onEdit}>
          עריכה
        </button>
        <button type="button" className="text-ink-soft hover:text-ink" disabled={pending} onClick={() => run(() => duplicateTemplate(template.id), "נוצר עותק")}>
          שכפול
        </button>
        <button type="button" className="text-ink-soft hover:text-ink" disabled={pending} onClick={() => run(() => updateTemplate(template.id, { archived: !template.archived_at }), template.archived_at ? "חזרה לשימוש" : "הועבר לארכיון")}>
          {template.archived_at ? "החזרה" : "ארכיון"}
        </button>
      </div>
    </li>
  );
}

function EditSheet({ template, settings, photoUrl, onClose }: { template: Template; settings: DesignSettings; photoUrl: string | null; onClose: () => void }) {
  const router = useRouter();
  const family = isTemplateFamily(template.family) ? template.family : "text_message";
  const [name, setName] = useState(template.name);
  const [bestUse, setBestUse] = useState(template.best_use ?? "");
  const [formats, setFormats] = useState<string[]>(template.formats);
  const [config, setConfig] = useState<Config>(asConfig(template.config));
  const [previewFormat, setPreviewFormat] = useState<RenderFormat>(template.formats.includes("story") ? "story" : "carousel");
  const [pending, startTransition] = useTransition();
  const html = useMemo(() => previewHtml(family, previewFormat, config, settings, photoUrl), [family, previewFormat, config, settings, photoUrl]);
  const set = (key: string, value: unknown) => setConfig((c) => ({ ...c, [key]: value }));
  const option = (key: string, label: string, choices: Array<[string, string]>, fallback: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-soft">{label}</span>
      <Select value={String(config[key] ?? fallback)} onChange={(e) => set(key, key === "numbering" ? e.target.value === "true" : e.target.value)}>
        {choices.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </Select>
    </label>
  );

  return (
    <Sheet
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title={template.name}
      description={FAMILY_LABEL[family]}
      footer={
        <Button
          variant="primary"
          className="w-full"
          pending={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateTemplate(template.id, { name, best_use: bestUse || null, formats: formats as Array<"story" | "carousel">, config: config as never });
              if (!result.ok) return void toast.error(result.error);
              toast.success("נשמר");
              onClose();
              router.refresh();
            })
          }
        >
          שמירה
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <FramePreview html={html} size={canvasSize(previewFormat)} label="תצוגה" />
          {formats.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {(["story", "carousel"] as const).map((f) => (
                <Chip key={f} size="sm" selected={previewFormat === f} onClick={() => setPreviewFormat(f)}>
                  {f === "story" ? "סטורי" : "קרוסלה"}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-soft">שם</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-soft">מתי משתמשים בה</span>
            <Textarea rows={2} value={bestUse} onChange={(e) => setBestUse(e.target.value)} />
          </label>
          <div>
            <span className="text-xs text-ink-soft">פורמטים</span>
            <div className="mt-1 flex gap-1.5">
              {(["story", "carousel"] as const).map((f) => (
                <Chip
                  key={f}
                  size="sm"
                  selected={formats.includes(f)}
                  onClick={() => setFormats((prev) => (prev.includes(f) ? (prev.length > 1 ? prev.filter((x) => x !== f) : prev) : [...prev, f]))}
                >
                  {f === "story" ? "סטורי" : "קרוסלה"}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {family === "text_message" &&
              option("align", "יישור", [
                ["start", "לימין"],
                ["center", "למרכז"],
              ], "start")}
            {family === "question" &&
              option("background", "רקע", [
                ["ink", "כהה"],
                ["pen", "כחול"],
                ["paper", "נייר"],
              ], "ink")}
            {family === "notes" &&
              option("paper", "דף", [
                ["lined", "שורות"],
                ["plain", "חלק"],
              ], "lined")}
            {PHOTO_FAMILIES.has(family) && (
              <>
                {option("textPosition", "מיקום הטקסט", [
                  ["bottom", "למטה"],
                  ["top", "למעלה"],
                ], family === "product_in_life" ? "top" : "bottom")}
                {option("scrim", "הצללה מאחורי הטקסט", [
                  ["soft", "עדינה"],
                  ["strong", "חזקה"],
                  ["none", "בלי"],
                ], "soft")}
              </>
            )}
            {family === "conversation" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-soft">צד ראשון</span>
                  <Input value={String(config.leftLabel ?? "אני")} onChange={(e) => set("leftLabel", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-soft">צד שני</span>
                  <Input value={String(config.rightLabel ?? "הוא")} onChange={(e) => set("rightLabel", e.target.value)} />
                </label>
              </>
            )}
            {family === "carousel_editorial" &&
              option("numbering", "מספור שקפים", [
                ["true", "כן"],
                ["false", "לא"],
              ], "true")}
          </div>
          {PHOTO_FAMILIES.has(family) && !photoUrl && <p className="text-xs text-graphite">אחרי שמעלים תמונה לגלריה, התצוגה תהיה עם תמונה אמיתית.</p>}
          {family === "product_in_life" && <p className="text-xs text-graphite">המשחק מופיע בתוך תמונה אמיתית, בגודל האמיתי שלו (בערך 12×8 ס״מ). לא קופסה מרחפת.</p>}
        </div>
      </div>
    </Sheet>
  );
}
