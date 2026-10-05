"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { IconMore } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { PRIMARY_NAV, SECONDARY_NAV, isActive } from "./nav-items";
import { Wordmark } from "./wordmark";

/** Phone: bottom tab bar + "עוד" sheet. Desktop: a quiet rail on the start (right) side. */
export function AppNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = SECONDARY_NAV.some((item) => isActive(pathname, item.href));

  return (
    <>
      {/* desktop rail */}
      <nav aria-label="ניווט ראשי" className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-rule bg-paper px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 px-2">
          <Wordmark />
        </Link>
        <ul className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </ul>
        <div className="my-5 h-px bg-rule" aria-hidden />
        <ul className="flex flex-col gap-0.5">
          {SECONDARY_NAV.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </ul>
      </nav>

      {/* phone tab bar */}
      <nav
        aria-label="ניווט ראשי"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/92 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl items-stretch justify-between px-2 pt-1.5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            if (item.primary) {
              return (
                <li key={item.href} className="flex flex-1 justify-center">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-chip text-white shadow-lift transition-transform active:scale-95",
                      active ? "bg-pen-deep" : "bg-pen",
                    )}
                  >
                    <Icon size={24} />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.href} className="flex flex-1 justify-center">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-14 flex-col items-center gap-0.5 rounded-field px-2 py-1 text-[11px] font-medium transition-colors",
                    active ? "text-ink" : "text-graphite",
                  )}
                >
                  <Icon size={22} />
                  <span>{item.label}</span>
                  <span className={cn("h-0.5 w-4 rounded-chip", active ? "bg-ink" : "bg-transparent")} aria-hidden />
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "flex min-w-14 flex-col items-center gap-0.5 rounded-field px-2 py-1 text-[11px] font-medium",
                secondaryActive ? "text-ink" : "text-graphite",
              )}
            >
              <IconMore size={22} />
              <span>עוד</span>
              <span className={cn("h-0.5 w-4 rounded-chip", secondaryActive ? "bg-ink" : "bg-transparent")} aria-hidden />
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="עוד בסטודיו">
        <ul className="grid grid-cols-2 gap-2 pb-2">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 items-center gap-3 rounded-card border px-4 text-sm font-medium",
                    active ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink",
                  )}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}

function RailLink({ item, active }: { item: (typeof PRIMARY_NAV)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-field px-3 text-sm font-medium transition-colors",
          active ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
        )}
      >
        <Icon size={19} />
        {item.label}
      </Link>
    </li>
  );
}
