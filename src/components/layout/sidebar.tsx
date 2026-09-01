"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { useDismissable } from "@/components/ui/menu";

import { ThemeToggle } from "./theme-toggle";
import { healingStats, project, quarantined, workspace } from "@/lib/demo-data";
import type { ActiveProject, ShellProject, ShellUser } from "./app-shell";

import { Logo, Wordmark } from "./logo";
import { SidebarItem } from "./sidebar-item";

export function Sidebar({
  projects = [],
  activeProject = null,
  projectSummaries = [],
  user,
}: {
  projects?: ShellProject[];
  activeProject?: ActiveProject | null;
  projectSummaries?: ActiveProject[];
  /** Required: the sidebar only renders behind a session, so there is no
   *  fallback identity to show. It used to fall back to a demo person's name. */
  user: ShellUser;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useDismissable<HTMLDivElement>(switcherOpen, () =>
    setSwitcherOpen(false),
  );

  // Route from the live project when there is one. With no projects yet the
  // project-scoped nav is hidden entirely rather than linking into a project
  // that does not exist.
  // Follow the project in the URL rather than always the first one, which had
  // the nav showing one project's name and test count while the page beside it
  // rendered another's.
  const slugInUrl = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const current =
    projectSummaries.find((p) => p.slug === slugInUrl) ?? activeProject ?? null;

  const base = `/projects/${current?.slug ?? project.id}`;
  const hasProject = Boolean(current);

  const primaryNav = [
    { icon: "dashboard" as const, label: "Overview", href: base },
    { icon: "applicationMap" as const, label: "Application Map", href: `${base}/map` },
    { icon: "testPlan" as const, label: "Test Plan", href: `${base}/plan` },
    { icon: "requirements" as const, label: "Requirements", href: `${base}/prd` },
    { icon: "tests" as const, label: "Tests", href: `${base}/tests`, badge: current?.tests ?? 0 },
    { icon: "runs" as const, label: "Runs", href: `${base}/runs`, badge: undefined },
    { icon: "analytics" as const, label: "Analytics", href: `${base}/analytics` },
    { icon: "integrations" as const, label: "Integrations", href: `${base}/integrations` },
    { icon: "settings" as const, label: "Settings", href: `${base}/settings` },
  ];

  /* Ported from AIDLC-Azure's "Testing & Quality" section. */
  const qualityNav = [
    { icon: "shield" as const, label: "Release Gate", href: `${base}/release-gate` },
    { icon: "codeReview" as const, label: "Code Reviewer", href: `${base}/code-review` },
    { icon: "filter" as const, label: "Test Selection", href: `${base}/test-selection` },
    { icon: "trend" as const, label: "Risk Ranking", href: `${base}/prioritization` },
    { icon: "quarantine" as const, label: "Defect Prediction", href: `${base}/defect-prediction` },
    { icon: "sparkle" as const, label: "Root Cause", href: `${base}/root-cause` },
    { icon: "search" as const, label: "Repo Baseline", href: `${base}/repo-baseline` },
    { icon: "docs" as const, label: "Doc-Driven Tests", href: `${base}/doc-tests` },
  ];

  const secondaryNav = [
    {
      icon: "maintenance" as const,
      label: "Self-Healing",
      href: `${base}/healing`,
      badge: `${healingStats.healedToday} today`,
    },
    { icon: "quarantine" as const, label: "Quarantine", href: `${base}/quarantine`, badge: quarantined.length },
    { icon: "notification" as const, label: "Notifications", href: "/notifications" },
  ];

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  const usagePct = Math.round((workspace.minutesUsed / workspace.minutesTotal) * 100);

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "border-muted bg-container flex h-full shrink-0 flex-col border-r",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16 items-center" : "w-60",
      )}
    >
      {/* ---- Logo + project switcher ---- */}
      <div className={cn("flex flex-col gap-3 py-4", collapsed ? "items-center px-3" : "px-3")}>
        <Link
          href="/projects"
          aria-label="Parikshan, back to all projects"
          className={cn("flex items-center", collapsed ? "justify-center" : "px-0.5")}
        >
          {collapsed ? <Logo size={38} /> : <Wordmark height={34} />}
        </Link>

        {!collapsed && (
          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-expanded={switcherOpen}
              className={cn(
                "border-muted bg-action hover:bg-raised-2 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5",
                "transition-colors duration-[170ms] focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none",
              )}
            >
              <span className="bg-raised-2 text-label-sm text-secondary grid h-5 w-5 shrink-0 place-items-center rounded">
                {(current?.name ?? project.name).charAt(0)}
              </span>
              <span className="text-label-md text-primary min-w-0 flex-1 truncate text-left">
                {current?.name ?? project.name}
              </span>
              <AppIcon name="chevronDown" size="xs" className="icon-quaternary" />
            </button>

            {switcherOpen && (
              <div className="border-muted bg-raised absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-lg border p-1">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.slug}`}
                    onClick={() => setSwitcherOpen(false)}
                    className="text-body-md text-secondary hover:bg-raised-2 hover:text-primary block truncate rounded px-2 py-1.5"
                  >
                    {p.name}
                  </Link>
                ))}
                <div className="border-muted mt-1 border-t pt-1">
                  <Link
                    href="/projects"
                    onClick={() => setSwitcherOpen(false)}
                    className="text-body-md text-tertiary hover:bg-raised-2 hover:text-primary block rounded px-2 py-1.5"
                  >
                    All projects
                  </Link>
                  <Link
                    href="/projects/new"
                    onClick={() => setSwitcherOpen(false)}
                    className="text-body-md text-tertiary hover:bg-raised-2 hover:text-primary block rounded px-2 py-1.5"
                  >
                    New project
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Navigation ---- */}
      <nav
        aria-label="Main navigation"
        className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-3", collapsed && "px-3")}
      >
        {hasProject ? (
        <>
        <ul className={cn("flex flex-col gap-1", collapsed && "items-center")}>
          {primaryNav.map((item) => (
            <li key={item.label} className={collapsed ? undefined : "w-full"}>
              <SidebarItem
                icon={item.icon}
                label={item.label}
                href={item.href}
                badge={item.badge}
                collapsed={collapsed}
                active={isActive(item.href)}
              />
            </li>
          ))}
        </ul>

        <div className={cn("border-muted my-3 border-t", collapsed && "w-9")} />

        <ul className={cn("flex flex-col gap-1", collapsed && "items-center")}>
          {qualityNav.map((item) => (
            <li key={item.label} className={collapsed ? undefined : "w-full"}>
              <SidebarItem
                icon={item.icon}
                label={item.label}
                href={item.href}
                collapsed={collapsed}
                active={isActive(item.href)}
              />
            </li>
          ))}
        </ul>

        <div className={cn("border-muted my-3 border-t", collapsed && "w-9")} />

        <ul className={cn("flex flex-col gap-1", collapsed && "items-center")}>
          {secondaryNav.map((item) => (
            <li key={item.label} className={collapsed ? undefined : "w-full"}>
              <SidebarItem
                icon={item.icon}
                label={item.label}
                href={item.href}
                badge={item.badge}
                collapsed={collapsed}
                active={isActive(item.href)}
              />
            </li>
          ))}
        </ul>
        </>
        ) : (
          <p className={cn("text-body-sm text-quaternary px-1 py-2", collapsed && "hidden")}>
            Create a project to get started.
          </p>
        )}
      </nav>

      {/* ---- Bottom block ---- */}
      <div className={cn("border-muted border-t px-3 py-3", collapsed && "w-full")}>
        <div className={cn("mb-3 flex", collapsed && "justify-center")}>
          <ThemeToggle variant="nav" collapsed={collapsed} />
        </div>

        {!collapsed && (
          <div className="mb-3">
            <div className="flex items-baseline justify-between">
              <span className="text-label-sm text-tertiary">Test minutes</span>
              <span className="text-label-sm text-secondary tabular">
                {workspace.minutesUsed.toLocaleString()} / {workspace.minutesTotal.toLocaleString()}
              </span>
            </div>
            <div className="bg-raised mt-1.5 h-1 w-full overflow-hidden rounded-full">
              <div className="bg-action-primary h-full rounded-full" style={{ width: `${usagePct}%` }} />
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <Link
            href="/settings"
            className={cn(
              "group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1",
              "hover:bg-action-tertiary-hover transition-colors duration-[170ms]",
              collapsed && "flex-none justify-center px-0",
            )}
            title={collapsed ? user.name : undefined}
          >
            <span className="bg-raised-2 text-secondary text-label-sm grid h-6 w-6 shrink-0 place-items-center rounded-full">
              {user.initials}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="text-label-md text-primary block truncate">{user.name}</span>
                <span className="text-caption text-quaternary block truncate">
                  {user.email || workspace.name}
                </span>
              </span>
            )}
          </Link>

          {!collapsed && (
            <a
              href="#"
              title="Documentation"
              aria-label="Documentation"
              className="icon-tertiary hover:icon-secondary hover:bg-action-tertiary-hover grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors duration-[170ms]"
            >
              <AppIcon name="docs" size="sm" />
            </a>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="icon-tertiary hover:icon-secondary hover:bg-action-tertiary-hover grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors duration-[170ms] focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none"
          >
            <AppIcon name={collapsed ? "expand" : "collapse"} size="sm" />
          </button>
        </div>
      </div>
    </aside>
  );
}
