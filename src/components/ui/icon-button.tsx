"use client";

import { cn } from "@/components/ui";
import type { IconName, IconSize } from "@/lib/icons";

import { AppIcon } from "./app-icon";

type Variant = "ghost" | "subtle" | "inverse";
type Size = "sm" | "md" | "lg";

/** Container box sizes, and the icon size each one carries. */
const SIZES: Record<Size, { box: string; icon: IconSize }> = {
  sm: { box: "h-8 w-8", icon: "sm" },
  md: { box: "h-9 w-9", icon: "md" },
  lg: { box: "h-10 w-10", icon: "lg" },
};

const VARIANTS: Record<Variant, string> = {
  // Transparent until touched - for dense toolbars.
  ghost: "icon-tertiary hover:icon-secondary hover:bg-action-tertiary-hover active:bg-action-tertiary-focused",
  // Sits on its own surface - the circular controls in the shell.
  subtle: "bg-action icon-secondary hover:bg-raised hover:icon-primary",
  // Selected / strong state: light surface, near-black glyph.
  inverse: "bg-action-primary icon-on-color hover:bg-action-primary-hover",
};

type IconButtonProps = {
  icon: IconName;
  /** Required: an icon-only control must expose an accessible name. */
  label: string;
  variant?: Variant;
  size?: Size;
  /** Circular for navigation; rounded-lg for toolbar controls. */
  shape?: "circle" | "rounded";
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "className">;

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  shape = "rounded",
  className,
  ...props
}: IconButtonProps) {
  const { box, icon: iconSize } = SIZES[size];

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid shrink-0 place-items-center",
        "transition-[background-color,color] duration-[170ms] ease-out",
        "focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none",
        "disabled:icon-quaternary disabled:pointer-events-none",
        shape === "circle" ? "rounded-full" : "rounded-lg",
        box,
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <AppIcon name={icon} size={iconSize} />
    </button>
  );
}
