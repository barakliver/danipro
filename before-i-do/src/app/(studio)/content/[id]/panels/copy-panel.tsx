"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useState } from "react";
import {
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  STORY_ELEMENT_KINDS,
  STORY_ELEMENT_LABEL,
  STORY_MAX_FRAMES,
  newFrame,
  newSlide,
  normalizeSlideRoles,
  type CarouselSlide,
  type Pov,
  type StoryFrame,
} from "@/lib/domain/content-body";
import { FILMED_FORMATS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/field";
import { IconArrowDown, IconArrowUp, IconCopy, IconDrag, IconPlus, IconTrash } from "@/components/ui/icons";
import { useEditor } from "../editor-context";
import { PhotoSlot } from "./photo-slot";
import { VoicePanel } from "./voice-panel";

export function CopyPanel({ onOpenVisual }: { onOpenVisual: () => void }) {
  const { draft, setField } = useEditor();
  const filmed = FILMED_FORMATS.has(draft.format);
  const isCarousel = draft.format === "carousel";

  return (
    <div className="flex flex-col gap-6">
      <Field label="נושא">
        {(p) => <Input {...p} value={draft.topic ?? ""} onChange={(e) => setField("topic", e.target.value || null)} placeholder="למשל: רשימת מוזמנים" />}
      </Field>

      <Field label={filmed ? "הוק / טקסט על המסך" : isCarousel ? "הוק (לא חובה, השקף הראשון הוא ההוק)" : "הוק / טקסט ראשי"}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={draft.hook ?? ""}
            onChange={(e) => setField("hook", e.target.value || null)}
            className="font-display text-xl leading-snug"
            placeholder="המשפט שגורם להגיד: זה אנחנו"
          />
        )}
      </Field>

      <VoicePanel />

      {filmed ? <PovEditor /> : isCarousel ? <SlidesEditor /> : <FramesEditor />}

      {!filmed && (
        <Button variant="quiet" size="lg" onClick={onOpenVisual} className="self-start">
          צור עיצוב
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Story frames

const LONG_FRAME = 120;

function splitFrame(frame: StoryFrame): StoryFrame[] {
  const sentences = frame.text.split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length < 2) return [frame];
  const half = Math.ceil(sentences.length / 2);
  return [
    { ...frame, text: sentences.slice(0, half).join(" ") },
    newFrame({ kind: frame.kind === "poll" || frame.kind === "question" ? "text" : frame.kind, text: sentences.slice(half).join(" ") }),
  ];
}

function FramesEditor() {
  const { draft, updateBody } = useEditor();
  const frames = draft.body.frames?.length ? draft.body.frames : [];
  const setFrames = (update: (frames: StoryFrame[]) => StoryFrame[]) => updateBody((b) => ({ ...b, frames: update(b.frames ?? []) }));

  return (
    <section aria-labelledby="frames-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="frames-title" className="font-display text-xl">
          פריימים
        </h2>
        <span className="text-xs text-graphite">
          {frames.length} מתוך {STORY_MAX_FRAMES}
        </span>
      </div>
      {frames.length === 0 && (
        <p className="rounded-card border border-dashed border-rule-strong p-5 text-sm text-graphite">
          אין עדיין פריימים. סטורי טוב הוא לרוב משפט אחד בכל פריים, ובסוף שאלה או סקר.
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {frames.map((frame, index) => (
          <li key={frame.id}>
            <FrameCard
              frame={frame}
              index={index}
              count={frames.length}
              onChange={(next) => setFrames((fs) => fs.map((f) => (f.id === frame.id ? next : f)))}
              onMove={(dir) => setFrames((fs) => arrayMove(fs, index, index + dir))}
              onDuplicate={() => setFrames((fs) => (fs.length >= STORY_MAX_FRAMES ? fs : [...fs.slice(0, index + 1), { ...frame, id: crypto.randomUUID() }, ...fs.slice(index + 1)]))}
              onDelete={() => setFrames((fs) => fs.filter((f) => f.id !== frame.id))}
              onSplit={() => setFrames((fs) => (fs.length >= STORY_MAX_FRAMES ? fs : fs.flatMap((f) => (f.id === frame.id ? splitFrame(f) : [f]))))}
              canSplit={frames.length < STORY_MAX_FRAMES}
            />
          </li>
        ))}
      </ol>
      <Button
        variant="quiet"
        disabled={frames.length >= STORY_MAX_FRAMES}
        onClick={() => setFrames((fs) => [...fs, newFrame()])}
        className="self-start"
      >
        <IconPlus size={18} />
        הוספת פריים
      </Button>
    </section>
  );
}

function FrameCard({
  frame,
  index,
  count,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  onSplit,
  canSplit,
}: {
  frame: StoryFrame;
  index: number;
  count: number;
  onChange: (frame: StoryFrame) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSplit: () => void;
  canSplit: boolean;
}) {
  const textId = useId();
  const long = frame.text.length > LONG_FRAME;
  return (
    <article className="rounded-card border border-rule bg-surface p-4" aria-label={`פריים ${index + 1}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">פריים {index + 1}</span>
        <div className="flex items-center">
          <IconButton label="להזיז קדימה" disabled={index === 0} onClick={() => onMove(-1)}>
            <IconArrowUp size={18} />
          </IconButton>
          <IconButton label="להזיז אחורה" disabled={index === count - 1} onClick={() => onMove(1)}>
            <IconArrowDown size={18} />
          </IconButton>
          <IconButton label="שכפול פריים" disabled={count >= STORY_MAX_FRAMES} onClick={onDuplicate}>
            <IconCopy size={18} />
          </IconButton>
          <IconButton label="מחיקת פריים" onClick={onDelete}>
            <IconTrash size={18} />
          </IconButton>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="סוג הפריים">
        {STORY_ELEMENT_KINDS.map((kind) => (
          <Chip key={kind} size="sm" selected={frame.kind === kind} onClick={() => onChange({ ...frame, kind, options: kind === "poll" && !frame.options?.length ? ["", ""] : frame.options })}>
            {STORY_ELEMENT_LABEL[kind]}
          </Chip>
        ))}
      </div>

      <label htmlFor={textId} className="sr-only">
        טקסט הפריים
      </label>
      <Textarea
        id={textId}
        rows={2}
        value={frame.text}
        onChange={(e) => onChange({ ...frame, text: e.target.value })}
        placeholder={frame.kind === "poll" ? "השאלה של הסקר" : frame.kind === "question" ? "השאלה לתיבה" : "משפט אחד. לא פסקה."}
        className="mt-3 font-display text-lg leading-snug"
      />
      {long && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-status-progress">
          פריים ארוך. בסטורי משפט אחד בכל פריים עובד יותר טוב.
          {canSplit && (
            <button type="button" onClick={onSplit} className="font-medium text-pen underline">
              לפצל לשני פריימים
            </button>
          )}
        </p>
      )}

      {frame.kind === "poll" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(frame.options?.length ? frame.options : ["", ""]).map((option, i, all) => (
            <Input
              key={i}
              aria-label={`תשובה ${i + 1}`}
              value={option}
              placeholder={`תשובה ${i + 1}`}
              onChange={(e) => onChange({ ...frame, options: all.map((o, j) => (j === i ? e.target.value : o)) })}
            />
          ))}
          <p className="col-span-2 text-xs text-graphite">את הסקר עצמו מוסיפים באינסטגרם. בעיצוב נשאר לו מקום.</p>
        </div>
      )}
      {frame.kind === "slider" && (
        <Input aria-label="אימוג׳י לסליידר" className="mt-3 w-24 text-center text-2xl" maxLength={4} value={frame.emoji ?? ""} placeholder="😅" onChange={(e) => onChange({ ...frame, emoji: e.target.value })} />
      )}

      <Input aria-label="שורה קטנה מתחת (לא חובה)" className="mt-3" value={frame.subtext ?? ""} placeholder="שורה קטנה מתחת (לא חובה)" onChange={(e) => onChange({ ...frame, subtext: e.target.value || undefined })} />

      {(frame.kind === "photo" || frame.kind === "video" || frame.kind === "product" || frame.assetId) && (
        <PhotoSlot className="mt-3" assetId={frame.assetId} onChange={(assetId) => onChange({ ...frame, assetId })} />
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Carousel slides

function SlidesEditor() {
  const { draft, updateBody } = useEditor();
  const slides = draft.body.slides ?? [];
  const setSlides = (update: (slides: CarouselSlide[]) => CarouselSlide[]) =>
    updateBody((b) => ({ ...b, slides: normalizeSlideRoles(update(b.slides ?? [])) }));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setSlides((s) => arrayMove(s, s.findIndex((x) => x.id === active.id), s.findIndex((x) => x.id === over.id)));
  };

  return (
    <section aria-labelledby="slides-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="slides-title" className="font-display text-xl">
          שקפים
        </h2>
        <span className={cn("text-xs", slides.length < CAROUSEL_MIN_SLIDES ? "text-status-progress" : "text-graphite")}>
          {slides.length} שקפים (בין {CAROUSEL_MIN_SLIDES} ל־{CAROUSEL_MAX_SLIDES})
        </span>
      </div>
      <DndContext id="slides-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-3">
            {slides.map((slide, index) => (
              <SortableSlide
                key={slide.id}
                slide={slide}
                index={index}
                count={slides.length}
                onChange={(next) => setSlides((s) => s.map((x) => (x.id === slide.id ? next : x)))}
                onMove={(dir) => setSlides((s) => arrayMove(s, index, index + dir))}
                onDuplicate={() => setSlides((s) => (s.length >= CAROUSEL_MAX_SLIDES ? s : [...s.slice(0, index + 1), { ...slide, id: crypto.randomUUID() }, ...s.slice(index + 1)]))}
                onDelete={() => setSlides((s) => s.filter((x) => x.id !== slide.id))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button variant="quiet" disabled={slides.length >= CAROUSEL_MAX_SLIDES} onClick={() => setSlides((s) => [...s, newSlide()])} className="self-start">
        <IconPlus size={18} />
        הוספת שקף
      </Button>
    </section>
  );
}

function SortableSlide({
  slide,
  index,
  count,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  slide: CarouselSlide;
  index: number;
  count: number;
  onChange: (slide: CarouselSlide) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const [showPhoto, setShowPhoto] = useState(Boolean(slide.assetId));
  const label = index === 0 ? "שקף פתיחה" : index === count - 1 ? "שקף אחרון" : `שקף ${index + 1}`;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "relative z-10 opacity-90")}>
      <article className={cn("rounded-card border bg-surface p-4", isDragging ? "border-pen shadow-lift" : "border-rule")} aria-label={label}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button type="button" {...attributes} {...listeners} className="-ms-2 inline-flex h-11 w-9 cursor-grab touch-none items-center justify-center text-mist active:cursor-grabbing" aria-label={`גרירה לשינוי סדר: ${label}`}>
              <IconDrag size={18} />
            </button>
            <span className="text-sm font-medium text-ink">{label}</span>
          </div>
          <div className="flex items-center">
            <IconButton label="להזיז קדימה" disabled={index === 0} onClick={() => onMove(-1)}>
              <IconArrowUp size={18} />
            </IconButton>
            <IconButton label="להזיז אחורה" disabled={index === count - 1} onClick={() => onMove(1)}>
              <IconArrowDown size={18} />
            </IconButton>
            <IconButton label="שכפול שקף" disabled={count >= CAROUSEL_MAX_SLIDES} onClick={onDuplicate}>
              <IconCopy size={18} />
            </IconButton>
            <IconButton label="מחיקת שקף" onClick={onDelete}>
              <IconTrash size={18} />
            </IconButton>
          </div>
        </div>
        <Textarea
          aria-label={`טקסט ${label}`}
          rows={index === 0 ? 2 : 1}
          value={slide.text}
          onChange={(e) => onChange({ ...slide, text: e.target.value })}
          placeholder={index === 0 ? "שקף פתיחה חזק" : "מחשבה אחת"}
          className={cn("mt-3 font-display leading-snug", index === 0 ? "text-xl" : "text-lg")}
        />
        {slide.text.length > 110 && <p className="mt-2 text-xs text-status-progress">שקף ארוך. מחשבה אחת בכל שקף.</p>}
        {showPhoto || slide.assetId ? (
          <PhotoSlot className="mt-3" assetId={slide.assetId} onChange={(assetId) => onChange({ ...slide, assetId })} />
        ) : (
          <button type="button" className="mt-2 text-sm font-medium text-pen" onClick={() => setShowPhoto(true)}>
            להוסיף תמונה לשקף
          </button>
        )}
      </article>
    </li>
  );
}

// ---------------------------------------------------------------------------
// POV / reels

function PovEditor() {
  const { draft, updateBody } = useEditor();
  const pov: Pov = draft.body.pov ?? { onScreenText: "", shot: "", action: "", length: "", location: "", props: [], gameAppears: false };
  const set = <K extends keyof Pov>(key: K, value: Pov[K]) => updateBody((b) => ({ ...b, pov: { ...pov, ...b.pov, [key]: value } }));

  return (
    <section aria-labelledby="pov-title" className="flex flex-col gap-4">
      <h2 id="pov-title" className="font-display text-xl">
        הצילום
      </h2>
      <Field label="טקסט על המסך">
        {(p) => <Textarea {...p} rows={2} value={pov.onScreenText} onChange={(e) => set("onScreenText", e.target.value)} className="font-display text-lg" placeholder="POV: ..." />}
      </Field>
      <Field label="מה עושים בפריים" hint="מה הגוף עושה, שנייה אחרי שנייה">
        {(p) => <Textarea {...p} rows={3} value={pov.action} onChange={(e) => set("action", e.target.value)} placeholder="מבט לטלפון. עצירה. מבט ישר למצלמה." />}
      </Field>
      <Field label="שוט">
        {(p) => <Input {...p} value={pov.shot} onChange={(e) => set("shot", e.target.value)} placeholder="טלפון סטטי על חצובה, גובה עיניים" />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="אורך">{(p) => <Input {...p} value={pov.length} onChange={(e) => set("length", e.target.value)} placeholder="5 עד 7 שניות" />}</Field>
        <Field label="לוקיישן">{(p) => <Input {...p} value={pov.location} onChange={(e) => set("location", e.target.value)} placeholder="מטבח" />}</Field>
        <Field label="סאונד">{(p) => <Input {...p} value={pov.sound ?? ""} onChange={(e) => set("sound", e.target.value || undefined)} placeholder="אודיו מקורי" />}</Field>
        <Field label="לבוש">{(p) => <Input {...p} value={pov.outfit ?? ""} onChange={(e) => set("outfit", e.target.value || undefined)} placeholder="בית, נוח" />}</Field>
      </div>
      <Field label="אביזרים" hint="מופרדים בפסיק">
        {(p) => (
          <Input
            {...p}
            value={pov.props.join(", ")}
            onChange={(e) => set("props", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
            placeholder="טלפון, מחשב, שני פתקים"
          />
        )}
      </Field>
      <Field label="מצלמה">{(p) => <Input {...p} value={pov.cameraSetup ?? ""} onChange={(e) => set("cameraSetup", e.target.value || undefined)} placeholder="חצובה / סלפי / מישהו מצלם" />}</Field>
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" className="h-5 w-5 accent-[var(--color-pen)]" checked={pov.gameAppears} onChange={(e) => set("gameAppears", e.target.checked)} />
        המשחק מופיע בפריים
      </label>
    </section>
  );
}

function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="inline-flex h-11 w-10 items-center justify-center rounded-chip text-graphite hover:bg-paper-deep hover:text-ink disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}
