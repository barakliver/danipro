import type { SVGProps } from "react";

// A small, quiet line-icon set drawn for this studio (1.6px strokes, 24px grid).
// Icons support labels; they never replace them.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
  </Base>
);
export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);
export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconIdea = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
    <path d="M15 3.5V7h3.5M9 12h6M9 15.5h4" />
  </Base>
);
export const IconGallery = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="M4 17l5-4.5 4 3.5 2.5-2 4.5 3.5" />
  </Base>
);
export const IconMore = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Base>
);
export const IconAudience = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 17.5V6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9z" />
    <path d="M8.5 9h7M8.5 12h4" />
  </Base>
);
export const IconBrain = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
    <path d="M5 16.5a3 3 0 0 1 3-3h11M9 8h6" />
  </Base>
);
export const IconTemplates = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3.5" width="9" height="13" rx="2" />
    <path d="M16 7h2a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V19.5" />
  </Base>
);
export const IconAnalytics = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 19.5h16M7 16v-4M12 16V7M17 16v-6.5" />
  </Base>
);
export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Base>
);
export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6.5" width="13" height="11" rx="2.5" />
    <path d="M16 10.5l5-3v9l-5-3" />
  </Base>
);
export const IconHighlights = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
  </Base>
);
export const IconCopy = (p: IconProps) => (
  <Base {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Base>
);
export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);
export const IconBack = (p: IconProps) => (
  // RTL: "back" points to the right
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);
export const IconChevronStart = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);
export const IconChevronEnd = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);
export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
  </Base>
);
export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6z" />
    <path d="M18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z" />
  </Base>
);
export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7" />
  </Base>
);
export const IconDrag = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={2.6} />
  </Base>
);
export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 19V8M7 12.5l5-5 5 5M5 4.5h14" />
  </Base>
);
export const IconStar = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8z" />
  </Base>
);
