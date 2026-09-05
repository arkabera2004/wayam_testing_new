"use client";

import { AppIcon } from "@/components/ui/app-icon";

import { useState } from "react";
import Link from "next/link";

import { Button, Card, Chip, EmptyState, Table, Td, Th, cn } from "@/components/ui";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";
import { PageThumbnail } from "@/components/ui/page-thumbnail";
import type { ApiEndpoint, DiscoveredPage } from "@/db/schema";

const FILTERS = ["has forms", "auth-gated", "API-backed"];

/** Headline numbers derived from the crawl, not hardcoded. */
type Stats = { pages: number; journeys: number; apis: number; gated: number };

/** Seconds into the crawl, shown as mm:ss the way the capture log reads. */
function formatFirstSeen(sec: number | null) {
  if (sec == null) return "-";
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

/** Built per render because the counts come from the project being viewed. */
function statCards(s: Stats): { icon: Icon3DName; value: number; label: string }[] {
  return [
    { icon: "pages-found", value: s.pages, label: "Pages found" },
    { icon: "journey", value: s.journeys, label: "Journeys mapped" },
    { icon: "api-inventory", value: s.apis, label: "API endpoints" },
    { icon: "auth-gated", value: s.gated, label: "Auth-gated" },
  ];
}

export function MapView({
  id,
  pages,
  endpoints,
  stats,
}: {
  id: string;
  pages: DiscoveredPage[];
  endpoints: ApiEndpoint[];
  stats: Stats;
}) {
  const [tab, setTab] = useState<"graph" | "apis">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(100);

  /** Card width scales with zoom, so the grid reflows instead of clipping. */
  const ZOOM_STEPS = [70, 85, 100, 125, 150];
  const stepZoom = (dir: 1 | -1) =>
    setZoom((z) => {
      const i = ZOOM_STEPS.indexOf(z);
      return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))] ?? z;
    });

  const page = pages.find((p) => p.path === selected) ?? null;

  const toggleFilter = (f: string) =>
    setActiveFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const filtered = pages.filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.path.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q)) return false;
    if (activeFilters.includes("has forms") && p.forms === 0) return false;
    if (activeFilters.includes("auth-gated") && !p.gated) return false;
    if (activeFilters.includes("API-backed") && p.apis === 0) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* ---- Toolbar ---- */}
      <div className="border-muted flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("graph")}
            className={cn(
              "text-label-md rounded-lg px-2.5 py-1 transition-colors duration-[170ms]",
              tab === "graph" ? "bg-raised-2 text-primary" : "text-tertiary hover:text-primary",
            )}
          >
            Graph
          </button>
          <button
            type="button"
            onClick={() => setTab("apis")}
            className={cn(
              "text-label-md rounded-lg px-2.5 py-1 transition-colors duration-[170ms]",
              tab === "apis" ? "bg-raised-2 text-primary" : "text-tertiary hover:text-primary",
            )}
          >
            API inventory
          </button>
        </div>

        <div className="border-muted bg-container ml-2 flex h-8 items-center gap-2 rounded-lg border px-2.5">
          <AppIcon name="search" size="xs" className="icon-quaternary shrink-0" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages"
            aria-label="Search pages"
            className="text-body-md text-primary placeholder:text-quaternary w-40 bg-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <AppIcon name="filter" size="xs" className="icon-quaternary" aria-hidden="true" />
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => toggleFilter(f)}>
              <Chip tone={activeFilters.includes(f) ? "solid" : "neutral"}>{f}</Chip>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Zoom out"
            disabled={zoom === ZOOM_STEPS[0]}
            onClick={() => stepZoom(-1)}
          >
            <AppIcon name="minus" size="sm" aria-hidden="true" />
          </Button>
          <span className="text-label-sm text-tertiary tabular w-10 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Zoom in"
            disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            onClick={() => stepZoom(1)}
          >
            <AppIcon name="add" size="sm" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* ---- Body ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "graph" && filtered.length === 0 ? (
          <EmptyState
            icon="search"
            art={<Icon3D name="no-results" size={88} />}
            title="No pages match"
            description="Try a different search term or clear the active filters."
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setActiveFilters([]);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : tab === "graph" ? (
          <div className="p-5">
            {/* ---- Crawl summary ---- */}
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards(stats).map((s) => (
                <div
                  key={s.label}
                  className="border-muted bg-container flex items-center gap-3 rounded-xl border p-3"
                >
                  <Icon3D name={s.icon} size={40} />
                  <div className="min-w-0">
                    <p className="font-display text-display-xs text-primary tabular">{s.value}</p>
                    <p className="text-caption text-tertiary truncate">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round((zoom / 100) * 210)}px, 1fr))`,
              }}
            >
            {filtered.map((p) => (
              <button
                key={p.path}
                type="button"
                onClick={() => setSelected(p.path)}
                className={cn(
                  "border-muted bg-container hover:bg-raised rounded-xl border p-3 text-left",
                  "transition-[background-color,border-color] duration-[170ms]",
                  selected === p.path && "border-active bg-raised",
                )}
              >
                <PageThumbnail path={p.path} gated={p.gated ?? false} />

                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-label-md text-primary truncate">{p.title}</p>
                    <p className="text-caption text-quaternary truncate">{p.path}</p>
                  </div>
                  {p.gated ? (
                    <AppIcon name="lock" size="xs" className="icon-quaternary mt-0.5 shrink-0" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(p.forms ?? 0) > 0 ? <Chip>{p.forms} forms</Chip> : null}
                  {(p.apis ?? 0) > 0 ? <Chip>{p.apis} APIs</Chip> : null}
                </div>
              </button>
            ))}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <Card title="Discovered endpoints" subtitle="Captured from live network traffic during crawl" padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Method</Th>
                    <Th>Path</Th>
                    <Th className="text-right">Status</Th>
                    <Th className="text-right">First seen</Th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((api) => (
                    <tr key={`${api.method} ${api.path}`} className="hover:bg-raised transition-colors duration-[170ms]">
                      <Td>
                        <Chip tone={api.method === "GET" ? "info" : "success"}>{api.method}</Chip>
                      </Td>
                      <Td className="text-primary">{api.path}</Td>
                      <Td className="tabular text-right">{api.status}</Td>
                      <Td className="tabular text-quaternary text-right">{formatFirstSeen(api.firstSeenSec)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        )}
      </div>

      {/* ---- Page inspector slide-over ---- */}
      {page && (
        <aside
          aria-label={`Details for ${page.path}`}
          className="border-muted bg-container fixed top-16 right-0 bottom-0 z-30 flex w-full max-w-sm flex-col border-l"
        >
          <header className="border-muted flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="text-heading-sm text-primary truncate">{page.title}</p>
              <p className="text-caption text-quaternary truncate">{page.path}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close inspector"
              className="icon-tertiary hover:icon-secondary hover:bg-raised grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            >
              <AppIcon name="close" size="sm" aria-hidden="true" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <PageThumbnail path={page.path} gated={page.gated ?? false} />

            <div className="flex flex-wrap gap-1.5">
              <Chip tone="warning">{page.risk}</Chip>
              {page.gated ? <Chip tone="info">auth-gated</Chip> : null}
            </div>

            <div>
              <p className="text-label-sm text-tertiary">Detected elements</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {[
                  `${page.forms} form${page.forms === 1 ? "" : "s"}`,
                  "12 links",
                  "4 buttons",
                  "2 inputs with validation",
                ].map((el) => (
                  <li key={el} className="text-body-md text-secondary flex items-center gap-2">
                    <AppIcon name="fileCode" size="xs" className="icon-quaternary shrink-0" aria-hidden="true" />
                    {el}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-label-sm text-tertiary">Associated API calls</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {endpoints.slice(0, page.apis ?? 0).map((api) => (
                  <li key={`${api.method} ${api.path}`} className="flex items-center gap-2">
                    <AppIcon name="network" size="xs" className="icon-quaternary shrink-0" aria-hidden="true" />
                    <span className="text-body-sm text-secondary truncate">
                      {api.method} {api.path}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-muted border-t p-4">
            <Link href={`/projects/${id}/plan`}>
              <Button variant="primary" icon="chevronRight" className="w-full">
                Generate tests for this page
              </Button>
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}
