import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "quiet" | "ghost" | "danger" | "highlight";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<Variant, string> = {
  primary: "bg-pen text-white hover:bg-pen-deep active:bg-pen-deep",
  quiet: "bg-surface text-ink border border-rule hover:border-rule-strong active:bg-paper-deep",
  ghost: "text-ink-soft hover:bg-paper-deep active:bg-paper-deep",
  danger: "bg-surface text-danger border border-rule hover:bg-danger-wash",
  highlight: "bg-highlight text-ink hover:brightness-95",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-4.5 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2",
  icon: "h-11 w-11 justify-center",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  pending?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "quiet", size = "md", asChild, pending, className, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-chip font-medium transition-[background-color,border-color,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {children}
    </Comp>
  );
});
