"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/context/theme-context";
import { cn } from "@/components/ui";

/**
 * Two shapes, one behaviour:
 *  - "icon"  compact control for the topbar and marketing header
 *  - "nav"   sidebar row that matches SidebarItem, expanded or collapsed
 */
export function ThemeToggle({
  variant = "icon",
  collapsed = false,
}: {
  variant?: "icon" | "nav";
  collapsed?: boolean;
}) {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  if (variant === "nav") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={collapsed ? label : undefined}
        aria-label={label}
        className={cn(
          "group flex items-center gap-2.5 rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-active",
          collapsed ? "w-9" : "w-full pr-2",
        )}
      >
        <span
          className={cn(
            "bg-action icon-tertiary group-hover:bg-raised-2 group-hover:icon-secondary",
            "grid h-9 w-9 shrink-0 place-items-center rounded-full",
            "transition-[background-color,color] duration-[170ms] ease-out",
          )}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>

        {!collapsed && (
          <span className="text-label-md text-secondary group-hover:text-primary min-w-0 flex-1 truncate text-left transition-colors duration-[170ms]">
            {isDark ? "Light theme" : "Dark theme"}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="icon-tertiary hover:icon-secondary hover:bg-action-tertiary-hover grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-[170ms] focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none"
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
