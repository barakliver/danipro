"use client";

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Content } from "@/lib/content/types";
import type { ContentStatus } from "@/lib/domain/constants";
import type { ContentBody } from "@/lib/domain/content-body";
import { saveContent, type ContentPatch } from "@/lib/content/actions";
import type { AssetUrls } from "@/lib/gallery/urls";
import type { RenderContext } from "@/lib/render/context";
import type { PillarRef } from "@/lib/content/types";
import type { Recommendation } from "@/lib/render/recommend";

// One editor for every content type. Local draft state, debounced autosave of only
// the fields that changed, and a save indicator that never lies.

export type Draft = Pick<
  Content,
  | "format"
  | "pillar_id"
  | "topic"
  | "hook"
  | "body"
  | "caption"
  | "cta"
  | "supporting_story"
  | "visual_notes"
  | "notes"
  | "requires_filming"
  | "requires_product"
  | "requires_barak"
  | "requires_couple"
  | "product_presence"
  | "prep_minutes"
  | "location_category"
  | "template_id"
>;

type DraftKey = keyof Draft;

type Action =
  | { type: "set"; key: DraftKey; value: Draft[DraftKey] }
  | { type: "body"; update: (body: ContentBody) => ContentBody }
  | { type: "replace"; draft: Draft };

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "body":
      return { ...state, body: action.update(state.body) };
    case "replace":
      return action.draft;
  }
}

export type SaveState = { kind: "idle" | "dirty" | "saving" | "saved" | "error"; at?: string; error?: string };

type EditorValue = {
  id: string;
  draft: Draft;
  status: ContentStatus;
  setStatus: (s: ContentStatus) => void;
  calendar: Content["calendar"];
  setField: <K extends DraftKey>(key: K, value: Draft[K]) => void;
  updateBody: (update: (body: ContentBody) => ContentBody) => void;
  replaceDraft: (draft: Draft) => void;
  save: SaveState;
  flush: () => Promise<boolean>;
  render: RenderContext;
  assetUrls: AssetUrls;
  addAssetUrls: (urls: AssetUrls) => void;
  pillars: PillarRef[];
  recommendations: Recommendation[];
  avoidWords: string[];
};

const EditorContext = createContext<EditorValue | null>(null);

export function useEditor(): EditorValue {
  const value = use(EditorContext);
  if (!value) throw new Error("useEditor must be used inside <EditorProvider>");
  return value;
}

export function draftFrom(content: Content): Draft {
  return {
    format: content.format,
    pillar_id: content.pillar_id,
    topic: content.topic,
    hook: content.hook,
    body: content.body,
    caption: content.caption,
    cta: content.cta,
    supporting_story: content.supporting_story,
    visual_notes: content.visual_notes,
    notes: content.notes,
    requires_filming: content.requires_filming,
    requires_product: content.requires_product,
    requires_barak: content.requires_barak,
    requires_couple: content.requires_couple,
    product_presence: content.product_presence,
    prep_minutes: content.prep_minutes,
    location_category: content.location_category,
    template_id: content.template_id,
  };
}

const AUTOSAVE_MS = 900;

export function EditorProvider({
  content,
  render,
  assetUrls: initialUrls,
  pillars,
  recommendations,
  avoidWords,
  children,
}: {
  content: Content;
  render: RenderContext;
  assetUrls: AssetUrls;
  pillars: PillarRef[];
  recommendations: Recommendation[];
  avoidWords: string[];
  children: ReactNode;
}) {
  const [draft, dispatch] = useReducer(reducer, content, draftFrom);
  const [status, setStatus] = useState<ContentStatus>(content.status);
  const [save, setSave] = useState<SaveState>({ kind: "idle", at: content.updated_at });
  const [assetUrls, setAssetUrls] = useState<AssetUrls>(initialUrls);

  const saved = useRef<Draft>(draftFrom(content));
  const latest = useRef<Draft>(draft);
  latest.current = draft;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const persist = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current;
    const current = latest.current;
    const patch: ContentPatch = {};
    for (const key of Object.keys(current) as DraftKey[]) {
      if (JSON.stringify(current[key]) !== JSON.stringify(saved.current[key])) {
        (patch as Record<string, unknown>)[key] = current[key];
      }
    }
    if (Object.keys(patch).length === 0) {
      setSave((s) => (s.kind === "dirty" ? { kind: "saved", at: s.at } : s));
      return true;
    }
    setSave({ kind: "saving" });
    const run = saveContent(content.id, patch).then((result) => {
      if (result.ok) {
        saved.current = { ...saved.current, ...(patch as Partial<Draft>) };
        setSave({ kind: JSON.stringify(latest.current) === JSON.stringify(saved.current) ? "saved" : "dirty", at: result.data.savedAt });
        return true;
      }
      setSave({ kind: "error", error: result.error });
      return false;
    });
    inFlight.current = run;
    const ok = await run;
    inFlight.current = null;
    return ok;
  }, [content.id]);

  const schedule = useCallback(() => {
    setSave((s) => ({ kind: "dirty", at: s.at }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return persist();
  }, [persist]);

  // never lose a keystroke: save when the tab is hidden or the page is left
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== JSON.stringify(saved.current)) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const setField = useCallback(
    <K extends DraftKey>(key: K, value: Draft[K]) => {
      dispatch({ type: "set", key, value });
      schedule();
    },
    [schedule],
  );
  const updateBody = useCallback(
    (update: (body: ContentBody) => ContentBody) => {
      dispatch({ type: "body", update });
      schedule();
    },
    [schedule],
  );
  const replaceDraft = useCallback((next: Draft) => {
    dispatch({ type: "replace", draft: next });
    saved.current = next;
    setSave({ kind: "saved", at: new Date().toISOString() });
  }, []);
  const addAssetUrls = useCallback((urls: AssetUrls) => setAssetUrls((u) => ({ ...u, ...urls })), []);

  const value = useMemo<EditorValue>(
    () => ({
      id: content.id,
      draft,
      status,
      setStatus,
      calendar: content.calendar,
      setField,
      updateBody,
      replaceDraft,
      save,
      flush,
      render,
      assetUrls,
      addAssetUrls,
      pillars,
      recommendations,
      avoidWords,
    }),
    [content.id, content.calendar, draft, status, setField, updateBody, replaceDraft, save, flush, render, assetUrls, addAssetUrls, pillars, recommendations, avoidWords],
  );

  return <EditorContext value={value}>{children}</EditorContext>;
}
