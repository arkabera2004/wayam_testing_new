"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { useDismissable } from "@/components/ui/menu";

import { ThemeToggle } from "./theme-toggle";
import { project, workspace } from "@/lib/demo-data";
import type { IconName } from "@/lib/icons";
import type { ActiveProject, ShellProject, ShellUser } from "./app-shell";

import { Logo, Wordmark } from "./logo";
import { SidebarItem } from "./sidebar-item";

export function Sidebar({
  projects = [],
  activeProject = null,
  projectSummaries = [],
  user,
  testTimeMs = 0,
}: {
  projects?: ShellProject[];
  activeProject?: ActiveProject | null;
  projectSummaries?: ActiveProject[];
  testTimeMs?: number;
  /** Required: the sidebar only renders behind a session, so there is no
   *  fallback identity to show. It used to fall back to a demo person's name. */
  user: ShellUser;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useDismissable<HTMLDivElement>(userMenuOpen, () => setUserMenuOpen(false));
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

  type NavItem = { icon: IconName; label: string; href: string; badge?: number | string };
  type NavGroup = { key: string; label: string; icon: IconName; items: NavItem[] };

  const overview: NavItem = { icon: "dashboard", label: "Overview", href: base };

  /**
   * Grouped rather than one flat list. Fourteen items overflowed the viewport,
   * so the last few were only reachable by scrolling the nav - which is how
   * "Risk Ranking" ended up half visible. Each group collapses, and the one
   * holding the current route opens itself.
   */
  const groups: NavGroup[] = [
    {
      key: "plan",
      label: "Plan",
      icon: "testPlan",
      items: [
        { icon: "applicationMap", label: "Application Map", href: `${base}/map` },
        { icon: "testPlan", label: "Test Plan", href: `${base}/plan` },
        { icon: "requirements", label: "Requirements", href: `${base}/prd` },
        { icon: "docs", label: "Doc-Driven Tests", href: `${base}/doc-tests` },
        { icon: "search", label: "Repo Baseline", href: `${base}/repo-baseline` },
      ],
    },
    {
      key: "execute",
      label: "Execute",
      icon: "runs",
      items: [
        { icon: "tests", label: "Tests", href: `${base}/tests`, badge: current?.tests ?? 0 },
        { icon: "runs", label: "Runs", href: `${base}/runs` },
        { icon: "analytics", label: "Analytics", href: `${base}/analytics` },
      ],
    },
    {
      key: "quality",
      label: "Quality",
      icon: "shield",
      items: [
        { icon: "shield", label: "Release Gate", href: `${base}/release-gate` },
        { icon: "codeReview", label: "Code Reviewer", href: `${base}/code-review` },
        { icon: "filter", label: "Test Selection", href: `${base}/test-selection` },
        { icon: "trend", label: "Risk Ranking", href: `${base}/prioritization` },
        { icon: "quarantine", label: "Defect Prediction", href: `${base}/defect-prediction` },
        { icon: "sparkle", label: "Root Cause", href: `${base}/root-cause` },
      ],
    },
    {
      key: "maintain",
      label: "Maintain",
      icon: "maintenance",
      items: [
        {
          icon: "maintenance",
          label: "Self-Healing",
          href: `${base}/healing`,
          badge: current?.pendingHeals ? `${current.pendingHeals} pending` : undefined,
        },
        {
          icon: "quarantine",
          label: "Quarantine",
          href: `${base}/quarantine`,
          badge: current?.quarantined || undefined,
        },
      ],
    },
    {
      key: "workspace",
      label: "Workspace",
      icon: "settings",
      items: [
        { icon: "notification", label: "Notifications", href: "/notifications" },
        { icon: "integrations", label: "Integrations", href: `${base}/integrations` },
        { icon: "settings", label: "Settings", href: `${base}/settings` },
      ],
    },
  ];

  const initiallyOpen = useMemo(
    () =>
      groups
        .filter((g) => g.items.some((i) => (i.href === base ? pathname === base : pathname.startsWith(i.href))))
        .map((g) => g.key),
    // Recomputed per navigation so following a link into a closed group opens it.
    [pathname, base],
  );

  // Manual opens and closes are remembered against the path they were made
  // on. Navigating elsewhere drops them, so following a link into a group the
  // user had collapsed still reveals where they landed.
  const [manual, setManual] = useState<{ path: string; keys: string[] } | null>(null);
  const openGroups = manual?.path === pathname ? manual.keys : initiallyOpen;

  const toggleGroup = (key: string) =>
    setManual(() => ({
      path: pathname,
      keys: openGroups.includes(key) ? openGroups.filter((k) => k !== key) : [...openGroups, key],
    }));

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);


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
          <li className={collapsed ? undefined : "w-full"}>
            <SidebarItem
              icon={overview.icon}
              label={overview.label}
              href={overview.href}
              collapsed={collapsed}
              active={isActive(overview.href)}
            />
          </li>
        </ul>

        {/* Collapsed to the icon rail, group headers have nothing to label, so
            the items are shown flat and every destination stays one click away. */}
        {collapsed ? (
          <ul className="mt-1 flex flex-col items-center gap-1">
            {groups.flatMap((g) => g.items).map((item) => (
              <li key={item.label}>
                <SidebarItem
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  collapsed
                  active={isActive(item.href)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 flex flex-col gap-0.5">
            {groups.map((group) => {
              const open = openGroups.includes(group.key);
              const activeInside = group.items.some((i) => isActive(i.href));

              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={open}
                    aria-controls={`nav-group-${group.key}`}
                    className={cn(
                      "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2 transition-colors duration-[170ms]",
                      "hover:bg-action-tertiary-hover focus-visible:ring-active focus-visible:ring-2 focus-visible:outline-none",
                    )}
                  >
                    <AppIcon
                      name={group.icon}
                      size="sm"
                      className={activeInside ? "icon-secondary" : "icon-tertiary"}
                    />
                    <span
                      className={cn(
                        "text-label-md min-w-0 flex-1 truncate text-left",
                        activeInside ? "text-primary" : "text-secondary",
                      )}
                    >
                      {group.label}
                    </span>
                    {/* A dot marks the group holding the current page while it
                        is closed, so collapsing never hides where you are. */}
                    {!open && activeInside && <span className="bg-action-primary h-1.5 w-1.5 rounded-full" />}
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={cn(
                        "icon-quaternary shrink-0 transition-transform duration-[170ms]",
                        open && "rotate-180",
                      )}
                    />
                  </button>

                  {open && (
                    <ul id={`nav-group-${group.key}`} className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-3">
                      {group.items.map((item) => (
                        <li key={item.label} className="w-full">
                          <SidebarItem
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            badge={item.badge}
                            collapsed={false}
                            active={isActive(item.href)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
              <span className="text-label-sm text-tertiary">Test time</span>
              <span className="text-label-sm text-secondary tabular">
                {testTimeMs >= 60_000
                  ? `${Math.floor(testTimeMs / 60_000)}m ${Math.round((testTimeMs % 60_000) / 1000)}s`
                  : `${(testTimeMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <p className="text-caption text-quaternary mt-1">summed across every recorded run</p>
          </div>
        )}

        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          {/* User menu. Holds the account links and the way out, so the bottom
              row stays one control instead of three. */}
          <div className="relative min-w-0 flex-1" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title={collapsed ? user.name : undefined}
              className={cn(
                "group flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1",
                "hover:bg-action-tertiary-hover transition-colors duration-[170ms]",
                "focus-visible:ring-active focus-visible:ring-2 focus-visible:outline-none",
                collapsed && "justify-center px-0",
              )}
            >
              <span className="bg-raised-2 text-secondary text-label-sm grid h-6 w-6 shrink-0 place-items-center rounded-full">
                {user.initials}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="text-label-md text-primary block truncate">{user.name}</span>
                    <span className="text-caption text-quaternary block truncate">
                      {user.email || workspace.name}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={cn(
                      "icon-quaternary shrink-0 transition-transform duration-[170ms]",
                      userMenuOpen && "rotate-180",
                    )}
                  />
                </>
              )}
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="border-muted bg-container absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-xl border shadow-lg"
              >
                <Link
                  role="menuitem"
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="text-body-md text-secondary hover:bg-action-tertiary-hover flex items-center gap-2.5 px-3 py-2 transition-colors duration-[170ms]"
                >
                  <AppIcon name="settings" size="sm" className="icon-tertiary" />
                  Workspace settings
                </Link>
                <a
                  role="menuitem"
                  href="https://github.com/arkabera2004/wayam_testing_new#readme"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setUserMenuOpen(false)}
                  className="text-body-md text-secondary hover:bg-action-tertiary-hover flex items-center gap-2.5 px-3 py-2 transition-colors duration-[170ms]"
                >
                  <AppIcon name="docs" size="sm" className="icon-tertiary" />
                  Documentation
                </a>

                <div className="border-muted border-t" />

                <Link
                  role="menuitem"
                  href="/login"
                  onClick={() => setUserMenuOpen(false)}
                  className="text-body-md text-error hover:bg-error-surface flex items-center gap-2.5 px-3 py-2 transition-colors duration-[170ms]"
                >
                  <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
                  Log out
                </Link>
                <p className="text-caption text-quaternary border-muted border-t px-3 py-2">
                  Authentication is off, so this returns to the sign-in page without a session to end.
                </p>
              </div>
            )}
          </div>

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
