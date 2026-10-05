"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth/actions";
import {
  cancelInvite,
  changePassword,
  importPlan,
  inviteMember,
  removeLogo,
  resetDesignSettings,
  saveDesignSettings,
  shiftPlan,
  uploadLogo,
} from "@/lib/settings/actions";
import { canvasSize, renderDocument } from "@/lib/render/document";
import type { DesignSettings } from "@/lib/render/design-settings";
import { CLIENT_FONT_CSS } from "@/lib/render/fonts";
import { formatDayLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { FramePreview } from "@/components/render/frame-preview";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Input, Select } from "@/components/ui/field";

type Props = {
  settings: DesignSettings;
  account: { email: string | null; role: "owner" | "editor" };
  members: Array<{ id: string; name: string; role: string }>;
  invites: Array<{
    id: string;
    email: string;
    accepted_at: string | null;
    created_at: string;
  }>;
  provider: { text: boolean; image: boolean };
  plan: { startDate: string | null; bundled: boolean; today: string };
};

const SECTIONS = [
  ["design", "עיצוב הגרפיקות"],
  ["writing", "מנוע כתיבה"],
  ["plan", "תוכנית 60 הימים"],
  ["people", "מי בסטודיו"],
  ["account", "חשבון"],
] as const;

export function SettingsView(props: Props) {
  return (
    <main className="mx-auto max-w-4xl px-4 pt-6 pb-16 sm:px-6 lg:pt-10">
      <h1 className="font-display text-2xl font-medium lg:text-3xl">הגדרות</h1>
      <nav
        aria-label="חלקים"
        className="no-scrollbar sticky top-0 z-10 -mx-4 mt-4 flex gap-1 overflow-x-auto border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0"
      >
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="h-9 shrink-0 rounded-chip px-3 text-sm leading-9 text-ink-soft hover:bg-paper-deep"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-8 flex flex-col gap-14">
        <DesignSection settings={props.settings} />
        <WritingSection provider={props.provider} />
        <PlanSection plan={props.plan} />
        <PeopleSection
          members={props.members}
          invites={props.invites}
          isOwner={props.account.role === "owner"}
        />
        <AccountSection email={props.account.email} />
      </div>
    </main>
  );
}

function SectionTitle({
  id,
  title,
  lead,
}: {
  id: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="mb-4">
      <h2 id={`${id}-title`} className="font-display text-xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-0.5 max-w-prose text-sm text-graphite">{lead}</p>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------

const COLOR_LABELS: Array<[keyof DesignSettings["colors"], string]> = [
  ["paper", "רקע"],
  ["ink", "טקסט"],
  ["accent", "הדגשה"],
  ["muted", "משני"],
  ["note", "פתק"],
  ["highlight", "מרקר"],
];
const FONT_OPTIONS = [
  "Frank Ruhl Libre",
  "Heebo",
  "IBM Plex Sans Hebrew",
] as const;
const TREATMENTS: Array<[DesignSettings["imageTreatment"], string]> = [
  ["natural", "טבעי"],
  ["warm", "חמים"],
  ["soft", "רך"],
  ["mono", "שחור־לבן"],
];

function DesignSection({ settings }: { settings: DesignSettings }) {
  const router = useRouter();
  const [draft, setDraft] = useState(settings);
  const [pending, startTransition] = useTransition();
  const [logoPending, startLogo] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [seen, setSeen] = useState(settings);
  if (seen !== settings) {
    // the server copy changed (logo upload, reset): adopt it
    setSeen(settings);
    setDraft(settings);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const patch = <K extends keyof DesignSettings>(
    key: K,
    value: DesignSettings[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const previews = useMemo(
    () => [
      {
        format: "story" as const,
        html: renderDocument({
          format: "story",
          family: "text_message",
          frame: {
            kind: "text",
            text: "אמא שלו רוצה להוסיף עוד 40 מוזמנים.\nאת לא מכירה אף אחד מהם.",
          },
          settings: draft,
          fontCss: CLIENT_FONT_CSS,
          guides: true,
        }),
      },
      {
        format: "carousel" as const,
        html: renderDocument({
          format: "carousel",
          family: "notes",
          frame: {
            kind: "slide",
            text: "מה זה 'חתונה קטנה'\nכמה ההורים מעורבים\nמי באמת חייב להיות מוזמן",
            index: 1,
            total: 7,
            role: "body",
          },
          settings: draft,
          fontCss: CLIENT_FONT_CSS,
          guides: true,
        }),
      },
    ],
    [draft],
  );

  const number = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
  ) => (
    <label key={label} className="flex flex-col gap-1">
      <span className="text-xs text-ink-soft">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))
        }
      />
    </label>
  );

  return (
    <section
      id="design"
      aria-labelledby="design-title"
      className="scroll-mt-16"
    >
      <SectionTitle
        id="design"
        title="עיצוב הגרפיקות"
        lead="הערכים שכל סטורי וקרוסלה נבנים מהם. הקווים המקווקווים בתצוגה הם האזור הבטוח, הם לא מופיעים בייצוא."
      />
      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium">צבעים</legend>
            <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {COLOR_LABELS.map(([key, label]) => (
                <label
                  key={key}
                  className="flex flex-col items-center gap-1 text-xs text-ink-soft"
                >
                  <input
                    type="color"
                    value={draft.colors[key]}
                    onChange={(e) =>
                      patch("colors", {
                        ...draft.colors,
                        [key]: e.target.value,
                      })
                    }
                    className="h-12 w-12 cursor-pointer rounded-full border border-rule bg-transparent p-0.5"
                    aria-label={`צבע ${label}`}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="mb-2 text-sm font-medium">גופנים</legend>
            {(["display", "text"] as const).map((key) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs text-ink-soft">
                  {key === "display" ? "כותרות ומשפטים" : "טקסט משני"}
                </span>
                <Select
                  value={draft.fonts[key]}
                  onChange={(e) =>
                    patch("fonts", {
                      ...draft.fonts,
                      [key]: e.target.value as never,
                    })
                  }
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">
              גדלי טקסט (פיקסלים ברוחב 1080)
            </legend>
            <p className="text-xs text-graphite">
              הגודל נבחר לפי אורך המשפט: קצר מקבל ענק, ארוך מקבל קטן.
            </p>
            <div className="mt-2 grid grid-cols-4 gap-3">
              {(
                [
                  ["xl", "קצר מאוד", 40, 180],
                  ["lg", "קצר", 32, 150],
                  ["md", "בינוני", 24, 120],
                  ["sm", "ארוך", 18, 80],
                ] as const
              ).map(([key, label, min, max]) =>
                number(
                  label,
                  draft.textSizes[key],
                  (v) => patch("textSizes", { ...draft.textSizes, [key]: v }),
                  min,
                  max,
                ),
              )}
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="mb-2 text-sm font-medium">מרווחים ופינות</legend>
            {number(
              "ריווח",
              draft.spacing,
              (v) => patch("spacing", v),
              40,
              200,
            )}
            {number(
              "עיגול פינות",
              draft.radius,
              (v) => patch("radius", v),
              0,
              80,
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">טיפול בתמונות</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TREATMENTS.map(([key, label]) => (
                <Chip
                  key={key}
                  size="sm"
                  selected={draft.imageTreatment === key}
                  onClick={() => patch("imageTreatment", key)}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">אזורים בטוחים</legend>
            <p className="text-xs text-graphite">
              באינסטגרם החלק העליון והתחתון של סטורי מכוסים בממשק. טקסט לא נכנס
              לשם.
            </p>
            {(
              [
                ["storySafe", "סטורי"],
                ["carouselSafe", "קרוסלה"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="mt-3">
                <p className="text-xs font-medium text-ink-soft">{label}</p>
                <div className="mt-1 grid grid-cols-3 gap-3">
                  {number(
                    "למעלה",
                    draft[key].top,
                    (v) => patch(key, { ...draft[key], top: v }),
                    0,
                    600,
                  )}
                  {number(
                    "למטה",
                    draft[key].bottom,
                    (v) => patch(key, { ...draft[key], bottom: v }),
                    0,
                    700,
                  )}
                  {number(
                    "בצדדים",
                    draft[key].side,
                    (v) => patch(key, { ...draft[key], side: v }),
                    0,
                    300,
                  )}
                </div>
              </div>
            ))}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">חתימה ולוגו</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--color-pen)]"
                checked={draft.identifier.show}
                onChange={(e) =>
                  patch("identifier", {
                    ...draft.identifier,
                    show: e.target.checked,
                  })
                }
              />
              חתימה קטנה בפינה
            </label>
            {draft.identifier.show && !draft.logo && (
              <label className="mt-2 flex max-w-xs flex-col gap-1">
                <span className="text-xs text-ink-soft">טקסט החתימה</span>
                <Input
                  value={draft.identifier.text}
                  maxLength={40}
                  onChange={(e) =>
                    patch("identifier", {
                      ...draft.identifier,
                      text: e.target.value,
                    })
                  }
                />
              </label>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {settings.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logo}
                  alt="הלוגו"
                  className="h-10 w-auto rounded border border-rule bg-surface p-1"
                />
              ) : (
                <span className="text-xs text-graphite">
                  אין לוגו. החתימה תהיה טקסט.
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                aria-label="העלאת לוגו"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.set("logo", file);
                  startLogo(async () => {
                    const result = await uploadLogo(form);
                    if (!result.ok) toast.error(result.error);
                    else toast.success("הלוגו עודכן");
                    router.refresh();
                  });
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                pending={logoPending}
                onClick={() => fileRef.current?.click()}
              >
                {settings.logo ? "החלפת לוגו" : "העלאת לוגו"}
              </Button>
              {settings.logo && (
                <button
                  type="button"
                  className="text-sm text-graphite hover:text-ink"
                  onClick={() =>
                    startLogo(async () => {
                      const result = await removeLogo();
                      if (!result.ok) toast.error(result.error);
                      router.refresh();
                    })
                  }
                >
                  הסרה
                </button>
              )}
            </div>
          </fieldset>
        </div>

        <div className="order-first md:order-none md:sticky md:top-16 md:self-start">
          <div className="mx-auto grid max-w-[340px] grid-cols-2 items-start gap-3 md:max-w-none md:grid-cols-1">
            {previews.map((p) => (
              <FramePreview
                key={p.format}
                html={p.html}
                size={canvasSize(p.format)}
                label={p.format === "story" ? "תצוגת סטורי" : "תצוגת קרוסלה"}
                className={
                  p.format === "story"
                    ? "md:mx-auto md:w-[220px]"
                    : "md:mx-auto md:w-[260px]"
                }
              />
            ))}
          </div>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-20 z-10 mt-6 flex items-center gap-3 rounded-card border border-rule bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-6">
          <span className="me-auto text-sm text-graphite">
            יש שינויים שלא נשמרו
          </span>
          <Button size="sm" variant="ghost" onClick={() => setDraft(settings)}>
            ביטול
          </Button>
          <Button
            size="sm"
            variant="primary"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveDesignSettings(draft);
                if (!result.ok) return void toast.error(result.error);
                toast.success("נשמר. כל הגרפיקות מתעדכנות.");
                router.refresh();
              })
            }
          >
            שמירה
          </Button>
        </div>
      )}
      <button
        type="button"
        className="mt-3 text-xs text-graphite underline-offset-2 hover:underline"
        onClick={() => {
          if (!window.confirm("לחזור לערכי ברירת המחדל? הלוגו נשאר.")) return;
          startTransition(async () => {
            const result = await resetDesignSettings();
            if (!result.ok) toast.error(result.error);
            router.refresh();
          });
        }}
      >
        חזרה לברירת המחדל
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------

function WritingSection({
  provider,
}: {
  provider: { text: boolean; image: boolean };
}) {
  return (
    <section
      id="writing"
      aria-labelledby="writing-title"
      className="scroll-mt-16"
    >
      <SectionTitle id="writing" title="מנוע כתיבה" />
      <ul className="flex flex-col gap-3">
        <li className="rounded-card border border-rule bg-surface p-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                provider.text ? "bg-pen" : "bg-rule-strong",
              )}
              aria-hidden
            />
            <p className="font-medium">כתיבת טקסטים</p>
            <Tag tone={provider.text ? "pen" : "muted"}>
              {provider.text ? "מחובר" : "לא מחובר"}
            </Tag>
          </div>
          <p className="mt-2 text-sm text-graphite">
            {provider.text
              ? 'יצירה, כיוונים שונים ו"יותר אישי / פחות פרסומי" עובדים. כל מה שנכתב עובר בדיקת "נשמע כמו אנחנו".'
              : 'בלי מנוע, הסטודיו עדיין עובד: לוח, עורך, עיצוב, ייצוא, ובדיקת "נשמע כמו אנחנו" מקומית. ביצירה מקבלים שלד לכתוב עליו.'}
          </p>
          {!provider.text && (
            <p className="mt-2 text-xs text-graphite">
              כדי לחבר: מגדירים בשרת משתנה סביבה{" "}
              <code className="rounded bg-paper-deep px-1 font-mono" dir="ltr">
                ANTHROPIC_API_KEY
              </code>{" "}
              ומפעילים מחדש. המפתח נשאר בשרת ולא מגיע לדפדפן.
            </p>
          )}
        </li>
        <li className="rounded-card border border-rule bg-surface p-4">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-rule-strong"
              aria-hidden
            />
            <p className="font-medium">יצירת תמונות</p>
            <Tag tone="muted">לא מחובר</Tag>
          </div>
          <p className="mt-2 text-sm text-graphite">
            בכוונה. תמונות אמיתיות מהגלריה קודמות לכל דבר. כשיחובר, הוא ייצור רק
            רקעים, אף פעם לא טקסט בעברית ולא תמונות של המוצר או שלנו.
          </p>
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PlanSection({ plan }: { plan: Props["plan"] }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(plan.startDate ?? plan.today);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section id="plan" aria-labelledby="plan-title" className="scroll-mt-16">
      <SectionTitle
        id="plan"
        title="תוכנית 60 הימים"
        lead={
          plan.startDate
            ? `היום הראשון של התוכנית: ${formatDayLong(plan.startDate)}.`
            : "התוכנית עוד לא יובאה לסטודיו הזה."
        }
      />
      <div className="flex flex-col gap-4 rounded-card border border-rule bg-surface p-4">
        <label className="flex max-w-xs flex-col gap-1">
          <span className="text-xs text-ink-soft">יום 1 נופל על</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        {plan.startDate && (
          <div>
            <Button
              size="sm"
              pending={pending}
              disabled={startDate === plan.startDate}
              onClick={() =>
                startTransition(async () => {
                  const result = await shiftPlan(startDate);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(
                    `הלוח זז. ${result.data.moved} פריטים במקום החדש.`,
                  );
                  router.refresh();
                })
              }
            >
              להזיז את כל הלוח
            </Button>
            <p className="mt-1 text-xs text-graphite">
              מה שכבר פורסם נשאר בתאריך שלו.
            </p>
          </div>
        )}
        <div className="border-t border-rule pt-4">
          <p className="text-sm">
            {plan.bundled
              ? "אפשר לייבא שוב את הקובץ שמגיע עם הסטודיו, או להעלות גרסה חדשה שלו."
              : "מעלים את קובץ ה־xlsx של התוכנית."}
          </p>
          <p className="mt-0.5 text-xs text-graphite">
            ייבוא חוזר לא משכפל ולא דורס תוכן שכבר ערכת. רק מה שחסר נוסף.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-chip border border-rule bg-surface px-3.5 text-sm hover:border-rule-strong">
              {file ? file.name : "בחירת קובץ"}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              size="sm"
              variant="primary"
              pending={pending}
              disabled={!file && !plan.bundled}
              onClick={() =>
                startTransition(async () => {
                  const form = new FormData();
                  form.set("startDate", startDate);
                  if (file) form.set("file", file);
                  const result = await importPlan(form);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(
                    result.data.created
                      ? `נוספו ${result.data.created} פריטים חדשים`
                      : "הכל כבר כאן. לא נוסף כלום.",
                  );
                  setFile(null);
                  router.refresh();
                })
              }
            >
              ייבוא
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PeopleSection({
  members,
  invites,
  isOwner,
}: {
  members: Props["members"];
  invites: Props["invites"];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const open = invites.filter((i) => !i.accepted_at);

  return (
    <section
      id="people"
      aria-labelledby="people-title"
      className="scroll-mt-16"
    >
      <SectionTitle
        id="people"
        title="מי בסטודיו"
        lead="הסטודיו פרטי. רק מי שמופיע כאן רואה תוכן, תמונות וקהל."
      />
      <ul className="flex flex-col divide-y divide-rule rounded-card border border-rule bg-surface">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span>{m.name}</span>
            <span className="text-xs text-graphite">
              {m.role === "owner" ? "בעלים" : "עריכה"}
            </span>
          </li>
        ))}
        {open.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate" dir="ltr">
              {i.email}
            </span>
            <Tag tone="muted">ממתין להצטרפות</Tag>
            {isOwner && (
              <button
                type="button"
                className="text-xs text-graphite hover:text-ink"
                onClick={() =>
                  startTransition(async () => {
                    const result = await cancelInvite(i.id);
                    if (!result.ok) toast.error(result.error);
                    router.refresh();
                  })
                }
              >
                ביטול
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await inviteMember(email);
              if (!result.ok) return void toast.error(result.error);
              toast.success("ההזמנה נשמרה");
              setEmail("");
              router.refresh();
            });
          }}
        >
          <Input
            type="email"
            dir="ltr"
            placeholder="name@example.com"
            aria-label="מייל להזמנה"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" pending={pending} disabled={!email.trim()}>
            הזמנה
          </Button>
        </form>
      )}
      {isOwner && (
        <p className="mt-2 text-xs text-graphite">
          כשנפתח חשבון עם המייל הזה (ב־Supabase, תחת Authentication), הוא נכנס
          ישר לסטודיו.
        </p>
      )}
    </section>
  );
}

function AccountSection({ email }: { email: string | null }) {
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section
      id="account"
      aria-labelledby="account-title"
      className="scroll-mt-16"
    >
      <SectionTitle id="account" title="חשבון" />
      <p className="text-sm" dir="ltr">
        {email}
      </p>
      <form
        className="mt-3 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await changePassword(password);
            if (!result.ok) return void toast.error(result.error);
            toast.success("הסיסמה עודכנה");
            setPassword("");
          });
        }}
      >
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="סיסמה חדשה (10 תווים לפחות)"
          aria-label="סיסמה חדשה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" pending={pending} disabled={password.length < 10}>
          עדכון
        </Button>
      </form>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="ghost">
          יציאה
        </Button>
      </form>
    </section>
  );
}
