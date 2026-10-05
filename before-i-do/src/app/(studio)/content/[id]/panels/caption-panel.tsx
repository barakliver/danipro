"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { CopyButton } from "@/components/content/copy-button";
import { captionText } from "@/lib/content/copy-text";
import { useEditor } from "../editor-context";

export function CaptionPanel() {
  const { draft, setField } = useEditor();
  const caption = draft.caption ?? "";
  return (
    <div className="flex flex-col gap-5">
      <Field label="כיתוב" hint={`${caption.length} תווים. משפט או שניים עובדים הכי טוב.`}>
        {(p) => <Textarea {...p} rows={4} value={caption} onChange={(e) => setField("caption", e.target.value || null)} placeholder="כמו שהיית כותבת לחברה" />}
      </Field>
      <Field label="הנעה לפעולה" hint="שליחה, שמירה, תיוג או שאלה. לא 'קנו עכשיו'.">
        {(p) => <Input {...p} value={draft.cta ?? ""} onChange={(e) => setField("cta", e.target.value || null)} placeholder="תשלחי למי שאמר 'נעשה משהו קטן'" />}
      </Field>
      <Field label="סטורי המשך">
        {(p) => <Textarea {...p} rows={2} value={draft.supporting_story ?? ""} onChange={(e) => setField("supporting_story", e.target.value || null)} placeholder="סקר / שאלה שממשיכים בה אחרי הפוסט" />}
      </Field>
      <CopyButton text={captionText(draft)} label="העתקת כיתוב + הנעה לפעולה" variant="primary" size="lg" className="self-start" />
    </div>
  );
}
