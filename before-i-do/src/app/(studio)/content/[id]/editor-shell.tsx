"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DropdownMenu, Tabs } from "radix-ui";
import { toast } from "sonner";
import { duplicateContent, deleteContent } from "@/lib/content/actions";
import { hasGraphics } from "@/lib/render/plan";
import { FILMED_FORMATS, FORMAT_LABEL } from "@/lib/domain/constants";
import { formatTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { IconBack, IconMore } from "@/components/ui/icons";
import { StatusPill } from "@/components/content/meta";
import { useEditor } from "./editor-context";
import { CopyPanel } from "./panels/copy-panel";
import { VisualPanel } from "./panels/visual-panel";
import { CaptionPanel } from "./panels/caption-panel";
import { DetailsPanel } from "./panels/details-panel";
import { PreviewPane } from "./panels/preview-pane";
import { VersionsSheet } from "./panels/versions-sheet";
import { EDITOR_TABS, type EditorTab } from "./tabs";


const TAB_LABEL: Record<EditorTab, string> = { copy: "תוכן", visual: "ויזואל", caption: "כיתוב", details: "פרטים" };

export function EditorShell({ initialTab, title }: { initialTab: EditorTab; title: string | null }) {
  const { draft, status, save, flush, id } = useEditor();
  const [tab, setTab] = useState<EditorTab>(initialTab);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const graphic = hasGraphics(draft.format);
  const filmed = FILMED_FORMATS.has(draft.format);

  const changeTab = (next: string) => {
    setTab(next as EditorTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4">
          <Link
            href="/"
            onClick={() => void flush()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-chip text-ink-soft hover:bg-paper-deep"
            aria-label="חזרה"
          >
            <IconBack size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-ink">{title || draft.hook || FORMAT_LABEL[draft.format]}</p>
            <div className="flex items-center gap-2">
              <StatusPill status={status} />
              <SaveIndicator />
            </div>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="inline-flex h-11 w-11 items-center justify-center rounded-chip text-ink-soft hover:bg-paper-deep" aria-label="עוד פעולות">
              <IconMore size={22} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-field border border-rule bg-surface p-1 shadow-lift">
                <MenuItem onSelect={() => setVersionsOpen(true)}>היסטוריית גרסאות</MenuItem>
                <MenuItem
                  disabled={pending}
                  onSelect={() =>
                    startTransition(async () => {
                      await flush();
                      const result = await duplicateContent(id);
                      if (result.ok) {
                        toast.success("נוצר עותק");
                        router.push(`/content/${result.data.id}`);
                      } else toast.error(result.error);
                    })
                  }
                >
                  שכפול
                </MenuItem>
                <DropdownMenu.Separator className="my-1 h-px bg-rule" />
                <MenuItem
                  danger
                  onSelect={() =>
                    startTransition(async () => {
                      if (!window.confirm("למחוק את התוכן? אפשר יהיה לשחזר אותו רק דרך מסד הנתונים.")) return;
                      const result = await deleteContent(id);
                      if (result.ok) {
                        toast("התוכן נמחק");
                        router.push("/calendar");
                      } else toast.error(result.error);
                    })
                  }
                >
                  מחיקה
                </MenuItem>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        {save.kind === "error" && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-danger-wash px-4 py-2 text-sm text-danger">
            <span>השינויים לא נשמרו: {save.error}</span>
            <button type="button" className="font-medium underline" onClick={() => void flush()}>
              לנסות שוב
            </button>
          </div>
        )}
      </header>

      <Tabs.Root value={tab} onValueChange={changeTab} dir="rtl" className="mx-auto max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 lg:px-6">
        <div className="min-w-0">
          <Tabs.List aria-label="חלקי העורך" className="no-scrollbar sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-rule bg-paper/95 px-3 backdrop-blur-md sm:px-4 lg:static lg:bg-transparent lg:px-0 lg:pt-6">
            {EDITOR_TABS.map((t) => (
              <Tabs.Trigger
                key={t}
                value={t}
                className={cn(
                  "relative h-12 shrink-0 px-3.5 text-[15px] font-medium text-graphite transition-colors data-[state=active]:text-ink",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-chip after:bg-transparent data-[state=active]:after:bg-ink",
                )}
              >
                {t === "visual" && !graphic ? (filmed ? "צילום" : TAB_LABEL[t]) : TAB_LABEL[t]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="px-4 py-6 sm:px-6 lg:px-0">
            <Tabs.Content value="copy" className="outline-none">
              <CopyPanel onOpenVisual={() => changeTab("visual")} />
            </Tabs.Content>
            <Tabs.Content value="visual" className="outline-none">
              <VisualPanel />
            </Tabs.Content>
            <Tabs.Content value="caption" className="outline-none">
              <CaptionPanel />
            </Tabs.Content>
            <Tabs.Content value="details" className="outline-none">
              <DetailsPanel />
            </Tabs.Content>
          </div>
        </div>
        <aside className="hidden lg:block" aria-label="תצוגה מקדימה">
          <div className="sticky top-20 pt-6">
            <PreviewPane />
          </div>
        </aside>
      </Tabs.Root>

      <VersionsSheet open={versionsOpen} onOpenChange={setVersionsOpen} />
    </div>
  );
}

function SaveIndicator() {
  const { save } = useEditor();
  const text =
    save.kind === "saving" ? "שומרת…" : save.kind === "dirty" ? "שינויים לא שמורים" : save.kind === "error" ? "לא נשמר" : save.at ? `נשמר ${formatTime(save.at)}` : "נשמר";
  return (
    <span aria-live="polite" className={cn("text-xs", save.kind === "error" ? "text-danger" : "text-graphite")}>
      {text}
    </span>
  );
}

function MenuItem({ children, onSelect, danger, disabled }: { children: React.ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex h-11 cursor-pointer select-none items-center rounded-[8px] px-3 text-sm outline-none data-[highlighted]:bg-paper-deep data-[disabled]:opacity-50",
        danger ? "text-danger" : "text-ink",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
