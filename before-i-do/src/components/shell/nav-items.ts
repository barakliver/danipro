import type { ComponentType } from "react";
import {
  IconAnalytics,
  IconAudience,
  IconBrain,
  IconCalendar,
  IconCamera,
  IconGallery,
  IconHighlights,
  IconIdea,
  IconPlus,
  IconSettings,
  IconTemplates,
  IconToday,
} from "@/components/ui/icons";

export type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }>; primary?: boolean };

/** The five things done most often live in the phone's tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "היום", icon: IconToday },
  { href: "/calendar", label: "לוח", icon: IconCalendar },
  { href: "/create", label: "יצירה", icon: IconPlus, primary: true },
  { href: "/ideas", label: "רעיונות", icon: IconIdea },
  { href: "/gallery", label: "גלריה", icon: IconGallery },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/filming", label: "יום צילום", icon: IconCamera },
  { href: "/audience", label: "הקהל", icon: IconAudience },
  { href: "/brand", label: "Brand Brain", icon: IconBrain },
  { href: "/templates", label: "תבניות", icon: IconTemplates },
  { href: "/highlights", label: "היילייטס", icon: IconHighlights },
  { href: "/analytics", label: "מה עבד", icon: IconAnalytics },
  { href: "/settings", label: "הגדרות", icon: IconSettings },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
