"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { RunSuiteButton } from "@/components/run-suite-button";
import { icons } from "@/lib/icons";
import { useNotifications } from "@/context/notifications-context";
import { project } from "@/lib/demo-data";

import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  "release-gate": "Release Gate",
  "code-review": "Code Reviewer",
  "repo-baseline": "Repo Test Baseline",
  "doc-tests": "Doc-Driven Tests",
  prioritization: "Risk Ranking",
  "defect-prediction": "Defect Prediction",
  "root-cause": "Root Cause Analysis",
  "test-selection": "Test Selection",
  "express-checkout": "Express Checkout",
  "loyalty-tiers": "Loyalty Tiers v2",
  [project.id]: project.name,
};

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return segments.map((segment, i) => ({
    // A uuid segment is a record id, not words: dash-splitting turned a run id
    // into "7a7f3b97 0db0 4fea 894d 4bf000e795d8" across the breadcrumb.
    label:
      SEGMENT_LABELS[segment] ??
      (UUID_SEGMENT.test(segment)
        ? segment.slice(0, 8)
        : decodeURIComponent(segment).replace(/-/g, " ")),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));
}

export function Topbar() {
  const crumbs = useBreadcrumbs();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { unread } = useNotifications();
  const slugMatch = usePathname().match(/^\/projects\/([^/]+)/)?.[1] ?? null;
  // "/projects/new" is the create form, not a project - running a suite there
  // would POST to an id that does not exist.
  const slugInUrl = slugMatch === "new" ? null : slugMatch;

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

        {/* An environment chip used to live here, hardcoded to "production"
            from the demo dataset, so every project claimed to be in prod.
            There is no environment column to read, so rather than invent one
            the chip is gone until projects actually record it. */}

        <ThemeToggle />

        {/* Runs the suite for the project in the URL. It used to navigate to
            a hardcoded run id, which is not a uuid and 500'd the run page. */}
        {slugInUrl ? (
          <RunSuiteButton projectSlug={slugInUrl} />
        ) : (
          <Link href="/projects">
            <Button variant="primary" icon="play">
              Run suite
            </Button>
          </Link>
        )}

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
