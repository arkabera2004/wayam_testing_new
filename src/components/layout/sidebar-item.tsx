"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/components/ui";

type SidebarItemProps = {
  icon: LucideIcon;
  /** Always present. Rendered when expanded; the aria-label when collapsed. */
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  badge?: string | number;
  onClick?: () => void;
};

export function SidebarItem({
  icon: Icon,
  label,
  href,
  active = false,
  disabled = false,
  collapsed = false,
  badge,
  onClick,
}: SidebarItemProps) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          "transition-[background-color,color] duration-[170ms] ease-out",
          disabled
            ? "bg-action-secondary-disabled icon-quaternary"
            : active
              ? "bg-action-primary icon-on-color"
              : "bg-action icon-tertiary group-hover:bg-raised-2 group-hover:icon-secondary",
        )}
      >
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      </span>

      {!collapsed && (
        <>
          <span
            className={cn(
              "text-label-md min-w-0 flex-1 truncate transition-colors duration-[170ms]",
              disabled
                ? "text-quaternary"
                : active
                  ? "text-primary"
                  : "text-secondary group-hover:text-primary",
            )}
          >
            {label}
          </span>
          {badge !== undefined && badge !== "" ? (
            <span className="bg-raised text-tertiary text-label-sm tabular shrink-0 rounded-md px-1.5 py-0.5">
              {badge}
            </span>
          ) : null}
        </>
      )}
    </>
  );

  const className = cn(
    "group flex items-center gap-2.5 rounded-full outline-none",
    "focus-visible:ring-2 focus-visible:ring-active",
    collapsed ? "w-9" : "w-full pr-2",
    disabled && "pointer-events-none",
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={className}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </button>
  );
}
