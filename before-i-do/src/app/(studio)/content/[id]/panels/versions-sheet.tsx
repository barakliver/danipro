"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { listVersions, restoreVersion } from "@/lib/content/actions";
import { formatDateTime } from "@/lib/utils/dates";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useEditor } from "../editor-context";

const REASON: Record<string, string> = {
  autosave: "שמירה אוטומטית",
  manual: "לפני שינוי",
  generation: "גרסה שנכתבה",
  restore: "שחזור",
  import: "מהתוכנית המקורית",
};

type Version = { id: string; reason: string; created_at: string; hook: string | null };

export function VersionsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { id, flush } = useEditor();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      await flush();
      const result = await listVersions(id);
      if (result.ok) setVersions(result.data);
      else toast.error(result.error);
    });
  }, [open, id, flush]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="היסטוריית גרסאות" description="שחזור מחזיר את הטקסט והעיצוב של אותו רגע. הגרסה הנוכחית נשמרת לפני כן.">
      {!versions && <p className="py-6 text-center text-sm text-graphite">טוענת…</p>}
      {versions?.length === 0 && <p className="py-6 text-center text-sm text-graphite">עוד אין גרסאות קודמות.</p>}
      <ol className="flex flex-col divide-y divide-rule">
        {versions?.map((v) => (
          <li key={v.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-ink">{v.hook || "בלי הוק"}</p>
              <p className="text-xs text-graphite">
                {formatDateTime(v.created_at)} | {REASON[v.reason] ?? v.reason}
              </p>
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await restoreVersion(id, v.id);
                  if (result.ok) {
                    toast.success("הגרסה שוחזרה");
                    onOpenChange(false);
                    // reload so the editor starts from the restored copy
                    window.location.reload();
                  } else toast.error(result.error);
                })
              }
            >
              שחזור
            </Button>
          </li>
        ))}
      </ol>
      <span className="sr-only">{pending ? "טוענת" : ""}</span>
    </Sheet>
  );
}
