"use client";

import { Direction } from "radix-ui";
import type { ReactNode } from "react";

/** Every Radix primitive (menus, tabs, dialogs) reads RTL from here. */
export function Providers({ children }: { children: ReactNode }) {
  return <Direction.Provider dir="rtl">{children}</Direction.Provider>;
}
