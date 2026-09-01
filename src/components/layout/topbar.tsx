"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button, cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { icons } from "@/lib/icons";
import { useNotifications } from "@/context/notifications-context";
import { project } from "@/lib/demo-data";

import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

/** Maps a URL segment to the label shown in the breadcrumb trail. */
const SEGMENT_LABELS: Record<string, string> = {
  projects: "Projects",
  new: "New project",
  map: "Application Map",
  plan: "Test Plan",
  tests: "Tests",
  runs: "Runs",
  results: "Result",
  healing: "Self-Healing",
  analytics: "Analytics",
  quarantine: "Quarantine",
  integrations: "Integrations",
  settings: "Settings",
  discovery: "Discovery",
  notifications: "Notifications",
  prd: "Requirements",
  "express-checkout": "Express Checkout",
  "loyalty-tiers": "Loyalty Tiers v2",
  [project.id]: project.name,
};

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return segments.map((segment, i) => ({
    label: SEGMENT_LABELS[segment] ?? decodeURIComponent(segment).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));
}

export function Topbar() {
  const crumbs = useBreadcrumbs();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { unread } = useNotifications();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="border-muted bg-page flex h-16 shrink-0 items-center gap-3 border-b px-5">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1">
            {crumbs.map((crumb) => (
              <li key={crumb.href} className="flex min-w-0 items-center gap-1">
                {crumb.last ? (
                  <span className="text-label-md text-primary truncate">{crumb.label}</span>
                ) : (
                  <>
                    <Link
                      href={crumb.href}
                      className="text-label-md text-tertiary hover:text-secondary truncate transition-colors duration-[170ms]"
                    >
                      {crumb.label}
                    </Link>
                    <AppIcon name="chevronRight" size="xs" className="icon-quaternary" />
                  </>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Search / command palette trigger */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "border-muted bg-container hover:bg-raised hidden w-72 items-center gap-2 rounded-lg border px-2.5 py-1.5 md:flex",
            "transition-colors duration-[170ms] focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none",
          )}
        >
          <AppIcon name="search" size="sm" className="icon-quaternary" />
          <span className="text-body-md text-quaternary min-w-0 flex-1 truncate text-left">
            Search tests, runs, pages...
          </span>
          <kbd className="bg-raised-2 text-caption text-tertiary rounded px-1.5 py-0.5">⌘K</kbd>
        </button>

        {/* Environment */}
        <span className="border-muted bg-container text-label-sm text-tertiary hidden rounded-full border px-2.5 py-1 lg:inline-flex">
          {project.environment}
        </span>

        <ThemeToggle />

        <Button
          variant="primary"
          icon={icons.play}
          onClick={() => router.push(`/projects/${project.id}/runs/137`)}
        >
          Run suite
        </Button>

        <Link
          href="/notifications"
          aria-label={`Notifications, ${unread} unread`}
          className="icon-tertiary hover:icon-secondary hover:bg-action-tertiary-hover relative grid h-8 w-8 place-items-center rounded-lg transition-colors duration-[170ms]"
        >
          <AppIcon name="notification" size="md" />
          {unread > 0 && (
            <span className="bg-error-icon ring-page absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ring-2" />
          )}
        </Link>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
