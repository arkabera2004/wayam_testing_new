"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IconName } from "@/lib/icons";

import { cn } from "./index";

import { AppIcon } from "@/components/ui/app-icon";
/** Closes a floating element on outside click or Escape. */
export function useDismissable<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return ref;
}

export type MenuItem = {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect?: () => void;
};

/**
 * Dropdown attached to a trigger. Used by the row context menus and the
 * avatar menu, so every "..." in the product actually opens something.
 */
export function Menu({
  trigger,
  items,
  align = "end",
  label,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="icon-quaternary hover:icon-secondary hover:bg-raised-2 grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[170ms] focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "border-muted bg-raised absolute top-full z-40 mt-1 min-w-44 overflow-hidden rounded-lg border p-1",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              className={cn(
                "text-body-md flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left",
                "transition-colors duration-[170ms]",
                item.danger
                  ? "text-error hover:bg-error-surface"
                  : "text-secondary hover:bg-raised-2 hover:text-primary",
              )}
            >
              {item.icon ? <AppIcon name={item.icon} size="sm" className="shrink-0" /> : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Loading placeholder that matches the shape of the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-raised animate-pulse rounded", className)} />;
}
