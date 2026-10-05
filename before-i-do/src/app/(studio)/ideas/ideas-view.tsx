"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { IDEA_TAGS } from "@/lib/domain/constants";
import { createIdea, deleteIdea, updateIdea } from "@/lib/ideas/actions";
import { suggestFormats } from "@/lib/ideas/suggest";
import { createContent } from "@/lib/content/actions";
import { uploadToGallery } from "@/lib/gallery/upload-client";
import type { AssetUrls } from "@/lib/gallery/urls";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { IconImage } from "@/components/ui/icons";
import { EmptyState } from "@/components/shell/page";

type Idea = { id: string; body: string; kind: string; asset_id: string | null; tags: string[]; status: string; created_at: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeech(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function IdeasView({ ideas, urls, workspaceId }: { ideas: Idea[]; urls: AssetUrls; workspaceId: string }) {
  const [filter, setFilter] = useState<"inbox" | "developed" | "archived">("inbox");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [optimistic, addOptimistic] = useOptimistic(ideas, (state, idea: Idea) => [idea, ...state]);
  const [developing, setDeveloping] = useState<Idea | null>(null);

  const shown = optimistic.filter((i) => i.status === filter && (!tagFilter || i.tags.includes(tagFilter)));
  const counts = { inbox: optimistic.filter((i) => i.status === "inbox").length, developed: optimistic.filter((i) => i.status === "developed").length };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">רעיונות</h1>
      <p className="mt-1 text-sm text-graphite">כל מה שקרה, נאמר או עלה בראש. לא כל רעיון חייב להפוך לתוכן.</p>

      <QuickCapture workspaceId={workspaceId} onSaved={addOptimistic} />

      <div className="mt-8 flex flex-wrap items-center gap-1.5">
        <Chip size="sm" selected={filter === "inbox"} onClick={() => setFilter("inbox")}>
          תיבה ({counts.inbox})
        </Chip>
        <Chip size="sm" selected={filter === "developed"} onClick={() => setFilter("developed")}>
          הפכו לתוכן ({counts.developed})
        </Chip>
        <Chip size="sm" selected={filter === "archived"} onClick={() => setFilter("archived")}>
          בארכיון
        </Chip>
        <span className="mx-1 h-5 w-px bg-rule" aria-hidden />
        <select aria-label="סינון לפי תגית" value={tagFilter ?? ""} onChange={(e) => setTagFilter(e.target.value || null)} className="h-8 rounded-chip border border-rule bg-surface px-3 text-xs text-ink-soft">
          <option value="">כל התגיות</option>
          {IDEA_TAGS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={filter === "inbox" ? "התיבה ריקה" : "אין כאן כלום"}>
            {filter === "inbox" ? "משפט ששמעת בטעימות? הודעה מזוג? צילום מסך? זורקים לכאן ומחליטים אחר כך." : null}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {shown.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} url={idea.asset_id ? urls[idea.asset_id]?.thumb : null} onDevelop={() => setDeveloping(idea)} />
          ))}
        </ul>
      )}

      <DevelopSheet idea={developing} onClose={() => setDeveloping(null)} />
    </main>
  );
}

function QuickCapture({ workspaceId, onSaved }: { workspaceId: string; onSaved: (idea: Idea) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setVoiceSupported(Boolean(getSpeech())), []);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const toggleVoice = () => {
    if (listening) return recognition.current?.stop();
    const Speech = getSpeech();
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = "he-IL";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
      if (said) {
        setText((t) => (t ? `${t} ${said}` : said));
        setUsedVoice(true);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast("לא הצלחנו לשמוע. אפשר לנסות שוב או להקליד.");
    };
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  const save = () =>
    startTransition(async () => {
      let assetId: string | undefined;
      if (file) {
        const uploaded = await uploadToGallery([file], workspaceId, { tags: ["רעיון"] });
        if (uploaded.failed.length) return void toast.error(uploaded.failed[0]);
        assetId = uploaded.ids[0];
      }
      const kind = file ? (file.name.toLowerCase().includes("screenshot") || file.type === "image/png" ? "screenshot" : "photo") : usedVoice ? "voice" : "text";
      const temp: Idea = { id: `temp-${Date.now()}`, body: text.trim(), kind, asset_id: assetId ?? null, tags, status: "inbox", created_at: new Date().toISOString() };
      onSaved(temp);
      const result = await createIdea({ body: text, kind, assetId, tags });
      if (!result.ok) return void toast.error(result.error);
      setText("");
      setTags([]);
      setFile(null);
      setPreview(null);
      setUsedVoice(false);
      toast.success("נשמר בתיבה");
      router.refresh();
    });

  return (
    <form
      className="mt-6 rounded-card border border-rule bg-surface p-3 shadow-lift sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="idea-text" className="sr-only">
        רעיון חדש
      </label>
      <Textarea
        id="idea-text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
        placeholder="זרקי פה משהו שקרה, משפט ששמעת או רעיון"
        className="border-0 px-1 font-display text-lg focus:ring-0"
      />
      {preview && (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={preview} alt="תמונה מצורפת" className="h-24 rounded-[10px] object-cover" />
          <button type="button" onClick={() => { setFile(null); setPreview(null); }} className="absolute -top-2 -start-2 h-7 w-7 rounded-full bg-ink text-xs text-paper" aria-label="להסיר תמונה">
            ✕
          </button>
        </div>
      )}
      <div className="no-scrollbar -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 sm:-mx-4 sm:px-4" role="group" aria-label="תגיות">
        {IDEA_TAGS.map((tag) => (
          <Chip key={tag} size="sm" selected={tags.includes(tag)} onClick={() => setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))}>
            {tag}
          </Chip>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="לצרף תמונה או צילום מסך"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
          <IconImage size={18} />
          תמונה
        </Button>
        {voiceSupported && (
          <Button type="button" variant={listening ? "highlight" : "ghost"} size="sm" onClick={toggleVoice} aria-pressed={listening}>
            {listening ? "מקשיבה… (לעצור)" : "להקליט"}
          </Button>
        )}
        <Button type="submit" variant="primary" className="ms-auto" pending={pending} disabled={!text.trim() && !file}>
          שמירה
        </Button>
      </div>
    </form>
  );
}

function IdeaCard({ idea, url, onDevelop }: { idea: Idea; url: string | null | undefined; onDevelop: () => void }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const temp = idea.id.startsWith("temp-");
  return (
    <li className={cn("rounded-card border border-rule bg-surface p-4", temp && "opacity-60")}>
      <div className="flex gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- signed private URL
          <img src={url} alt="" className="h-20 w-16 shrink-0 rounded-[10px] object-cover" />
        )}
        <div className="min-w-0 flex-1">
          {idea.body && <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink">{idea.body}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {idea.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            <span className="text-xs text-mist">{formatDateTime(idea.created_at)}</span>
          </div>
        </div>
      </div>
      {!temp && (
        <div className="mt-3 flex flex-wrap gap-2">
          {idea.status !== "developed" && (
            <Button size="sm" variant="primary" onClick={onDevelop}>
              פתח לתוכן
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const next = idea.status === "archived" ? "inbox" : "archived";
                const r = await updateIdea(idea.id, { status: next });
                if (!r.ok) toast.error(r.error);
                router.refresh();
              })
            }
          >
            {idea.status === "archived" ? "להחזיר לתיבה" : "לארכיון"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!window.confirm("למחוק את הרעיון?")) return;
                const r = await deleteIdea(idea.id);
                if (!r.ok) toast.error(r.error);
                router.refresh();
              })
            }
          >
            מחיקה
          </Button>
        </div>
      )}
    </li>
  );
}

function DevelopSheet({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suggestions = useMemo(() => (idea ? suggestFormats(idea.body, idea.tags) : []), [idea]);
  return (
    <Sheet open={Boolean(idea)} onOpenChange={(o) => !o && onClose()} title="פתח לתוכן" description="איך הרעיון הזה הכי טבעי? אפשר לכתוב עם עזרה או לפתוח טיוטה ולכתוב לבד.">
      {idea && (
        <div className="flex flex-col gap-4 pb-2">
          <blockquote className="rounded-field bg-paper px-4 py-3 font-display text-lg leading-snug">{idea.body || "רעיון עם תמונה"}</blockquote>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <li key={s.format} className={cn("rounded-card border p-3", i === 0 ? "border-ink" : "border-rule")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {s.label} {i === 0 && <Tag tone="highlight">מתאים</Tag>}
                    </p>
                    <p className="text-sm text-graphite">{s.why}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant={i === 0 ? "primary" : "quiet"} onClick={() => router.push(`/create?idea=${idea.id}&format=${s.format}`)}>
                    לכתוב עם עזרה
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await createContent({
                          format: s.format,
                          hook: idea.body || undefined,
                          idea_id: idea.id,
                          source: "idea",
                          body: idea.asset_id ? { frames: [{ id: crypto.randomUUID(), kind: "photo", text: "", assetId: idea.asset_id }] } : undefined,
                        });
                        if (!result.ok) return void toast.error(result.error);
                        router.push(`/content/${result.data.id}`);
                      })
                    }
                  >
                    טיוטה ריקה
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
