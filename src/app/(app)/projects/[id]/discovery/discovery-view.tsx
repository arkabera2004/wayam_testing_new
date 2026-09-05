"use client";

import { AppIcon } from "@/components/ui/app-icon";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Button, Card, Chip, cn } from "@/components/ui";
import type { ApiEndpoint, DiscoveredPage } from "@/db/schema";

const TICK_MS = 420;

type GraphNode = { id: string; label: string; x: number; y: number };

/**
 * Lays the discovered routes out as a tree: depth down the page, siblings
 * spread across it. The graph used to be a fixed set of storefront nodes, so a
 * project that had discovered nothing still drew /products and /checkout while
 * the counters above it read zero - the page contradicting itself.
 */
function buildGraph(paths: string[]): { nodes: GraphNode[]; edges: Array<[string, string]> } {
  if (paths.length === 0) return { nodes: [], edges: [] };

  const unique = [...new Set(paths)].sort();
  const depthOf = (p: string) => (p === "/" ? 0 : p.split("/").filter(Boolean).length);
  const maxDepth = Math.max(...unique.map(depthOf));

  const byDepth = new Map<number, string[]>();
  for (const p of unique) {
    const d = depthOf(p);
    byDepth.set(d, [...(byDepth.get(d) ?? []), p]);
  }

  // Wide levels wrap onto sub-rows. Eight siblings spread across one line
  // overlapped each other and ran off the canvas, so the labels were unreadable.
  const PER_ROW = 4;
  const rows: string[][] = [];
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const group = byDepth.get(depth)!;
    for (let i = 0; i < group.length; i += PER_ROW) rows.push(group.slice(i, i + PER_ROW));
  }

  const nodes: GraphNode[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((path, i) => {
      nodes.push({
        id: path,
        label: path,
        x: 10 + ((i + 1) / (row.length + 1)) * 80,
        // Spread over the canvas with a margin top and bottom.
        y: rows.length === 1 ? 50 : 12 + (rowIndex / (rows.length - 1)) * 62,
      });
    });
  });

  // An edge joins a route to the nearest ancestor that was also discovered.
  const known = new Set(unique);
  const edges: Array<[string, string]> = [];
  for (const path of unique) {
    if (path === "/") continue;
    const parts = path.split("/").filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const parent = i === 0 ? "/" : "/" + parts.slice(0, i).join("/");
      if (known.has(parent)) {
        edges.push([parent, path]);
        break;
      }
    }
  }

  return { nodes, edges };
}

export function DiscoveryView({
  id,
  pages,
  endpoints,
  stats,
  targetUrl,
}: {
  id: string;
  pages: DiscoveredPage[];
  endpoints: ApiEndpoint[];
  stats: { pages: number; journeys: number; apis: number };
  targetUrl: string;
}) {
  /**
   * The crawl log is derived from the pages and endpoints actually recorded,
   * so the feed replays what was found rather than reciting a fixed script.
   */
  const feed = [
    ...pages.flatMap((p) => [`Crawling ${p.path}`, ...((p.forms ?? 0) > 0 ? [`Found form on ${p.path}`] : [])]),
    ...endpoints.map((e) => `Captured ${e.method} ${e.path}`),
  ];
  const totalTicks = 22;

  /**
   * Starts finished. Nothing is being crawled when this page loads - the rows
   * were written by an earlier import - so replaying the sweep by default left
   * the page blank for nine seconds every visit, which read as "no data".
   * Replay is there for anyone who wants to watch it build.
   */
  const [tick, setTick] = useState(totalTicks);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const done = tick >= totalTicks;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setTick((v) => v + 1), TICK_MS);
    return () => clearTimeout(t);
  }, [tick, done]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [tick]);

  const progress = Math.min(1, tick / totalTicks);

  const { nodes: NODES, edges: EDGES } = useMemo(
    () => buildGraph(pages.map((p) => p.path)),
    [pages],
  );

  const visibleNodes = Math.min(NODES.length, Math.ceil(progress * NODES.length * 1.2));
  const visibleEdges = Math.min(EDGES.length, Math.floor(progress * EDGES.length * 1.1));
  const visibleFeed = Math.min(feed.length, Math.ceil(progress * feed.length));
  const visibleApis = Math.min(endpoints.length, Math.floor(progress * endpoints.length));

  const counters = useMemo(
    () => [
      {
        label: "Pages found",
        value: Math.round(progress * stats.pages),
        hint: stats.pages ? "routes read from the imported source" : "import a repository to populate this",
      },
      {
        label: "Journeys",
        value: Math.round(progress * stats.journeys),
        // Journeys are test suites, which come from an approved plan. A fresh
        // import has none, and a bare zero looked like a failure.
        hint: stats.journeys ? "suites covering these routes" : "created when a test plan is approved",
      },
      {
        label: "API endpoints",
        value: Math.round(progress * stats.apis),
        hint: stats.apis ? "handlers found in the source" : "none declared in the imported source",
      },
    ],
    [progress],
  );

  const elapsed = Math.round((tick * TICK_MS) / 1000);
  const nodeById = (nid: string) => NODES.find((n) => n.id === nid);

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="border-muted flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {done ? (
            <Chip tone="success">
              <AppIcon name="check" size="xs" aria-hidden="true" />
              Complete
            </Chip>
          ) : (
            <Chip tone="error">
              <span className="bg-error-icon h-1.5 w-1.5 animate-pulse rounded-full" />
              REPLAY
            </Chip>
          )}
          <span className="text-label-md text-primary truncate">{targetUrl}</span>
        </div>

        <span className="text-body-sm text-tertiary tabular ml-auto">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")} elapsed
        </span>

        {done && (
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onClick={() => setTick(0)}
            aria-label="Replay discovery"
          >
            Replay
          </Button>
        )}
      </header>

      {/* ---- Counters ---- */}
      <div className="border-muted grid grid-cols-3 border-b">
        {counters.map((c) => (
          <div key={c.label} className="border-muted border-r px-5 py-4 last:border-r-0">
            <p className="text-label-sm text-tertiary">{c.label}</p>
            <p className="font-display text-display-metric text-primary tabular mt-1">{c.value}</p>
            <p className="text-caption text-quaternary mt-1">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* ---- Graph + rails ---- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Graph canvas */}
        <div className="border-muted relative min-h-[28rem] overflow-hidden border-r">
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path
                  d="M32 0H0V32"
                  fill="none"
                  stroke="var(--stroke-disabled)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Nothing discovered is a real state. An empty grid reads as broken,
              so say what happened and where to go next. */}
          {NODES.length === 0 && (
            <div className="absolute inset-0 grid place-items-center px-6">
              <div className="max-w-md text-center">
                <p className="text-heading-sm text-primary">No routes discovered yet</p>
                <p className="text-body-md text-tertiary mt-2">
                  Nothing has been imported for this project, or the repository that was imported
                  did not declare routes Parikshan recognises. It reads Next.js, React Router,
                  Express, ASP.NET MVC, Flask and FastAPI, plus plain HTML and Razor templates.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href={`/projects/${id}/repo-baseline`}>
                    <Button variant="primary">Import a repository</Button>
                  </Link>
                  <Link href={`/projects/${id}/settings`}>
                    <Button variant="secondary">Project settings</Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Edges */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {EDGES.slice(0, visibleEdges).map(([from, to], i) => {
              const a = nodeById(from);
              const b = nodeById(to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--stroke-default)"
                  strokeWidth="0.25"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {NODES.slice(0, visibleNodes).map((node, i) => (
            <div
              key={node.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2",
                "border-muted bg-raised rounded-lg border px-2.5 py-1.5",
                "node-pop",
              )}
              style={{ left: `${node.x}%`, top: `${node.y}%`, animationDelay: `${i * 40}ms` }}
            >
              <p className="text-caption text-primary max-w-40 truncate" title={node.label}>
                {node.label}
              </p>
            </div>
          ))}

          {done && summaryOpen && (
            <div className="absolute right-4 bottom-4 z-10 max-w-sm">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-heading-sm text-primary">Discovery complete</p>
                  <button
                    type="button"
                    onClick={() => setSummaryOpen(false)}
                    aria-label="Dismiss summary"
                    className="icon-tertiary hover:icon-secondary hover:bg-action-tertiary-hover -mt-1 -mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors duration-[170ms]"
                  >
                    <AppIcon name="close" size="sm" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-body-md text-tertiary mt-1">
                  {stats.pages} {stats.pages === 1 ? "route" : "routes"}, {stats.journeys}{" "}
                  {stats.journeys === 1 ? "journey" : "journeys"} and {stats.apis} API{" "}
                  {stats.apis === 1 ? "endpoint" : "endpoints"} found in the imported source.
                </p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/projects/${id}/map`} className="flex-1">
                    <Button className="w-full">View application map</Button>
                  </Link>
                  <Link href={`/projects/${id}/plan`} className="flex-1">
                    <Button variant="primary" icon="arrowRight" className="w-full">
                      Generate test plan
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Right rail: feed + network capture */}
        <div className="flex min-h-0 flex-col">
          <div className="border-muted flex min-h-0 flex-1 flex-col border-b">
            <p className="text-label-sm text-tertiary border-muted border-b px-4 py-2.5">
              Activity
            </p>
            <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <ul className="flex flex-col gap-1.5">
                {feed.length === 0 && (
                  <li className="text-body-sm text-quaternary">
                    Nothing to report. Import a repository and the routes it finds appear here.
                  </li>
                )}
                {feed.slice(0, visibleFeed).map((line, i) => (
                  <li key={i} className="text-body-sm text-tertiary flex gap-2">
                    <span className="text-quaternary shrink-0">&rarr;</span>
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <p className="text-label-sm text-tertiary border-muted border-b px-4 py-2.5">
              Network capture
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <ul className="flex flex-col gap-1.5">
                {endpoints.length === 0 && (
                  <li className="text-body-sm text-quaternary">
                    No API endpoints found. These come from route handlers in the imported source.
                  </li>
                )}
                {endpoints.slice(0, visibleApis).map((api) => (
                  <li key={`${api.method} ${api.path}`} className="flex items-center gap-2">
                    <Chip tone={api.method === "GET" ? "info" : "success"}>{api.method}</Chip>
                    <span className="text-body-sm text-secondary min-w-0 flex-1 truncate">
                      {api.path}
                    </span>
                    <span className="text-caption text-quaternary tabular shrink-0">
                      {api.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
