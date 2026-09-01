"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

import { Button, Card, Chip, cn } from "@/components/ui";
import { apiEndpoints, discoveryFeed, discoveryStats, project } from "@/lib/demo-data";

/** Fixed node layout so the graph builds the same way on every take. */
const NODES = [
  { id: "home", label: "/", x: 50, y: 12 },
  { id: "products", label: "/products", x: 22, y: 32 },
  { id: "search", label: "/search", x: 78, y: 30 },
  { id: "detail", label: "/products/:slug", x: 18, y: 55 },
  { id: "login", label: "/login", x: 76, y: 54 },
  { id: "cart", label: "/cart", x: 44, y: 62 },
  { id: "account", label: "/account", x: 84, y: 76 },
  { id: "checkout", label: "/checkout", x: 40, y: 86 },
  { id: "settings", label: "/account/settings", x: 66, y: 92 },
];

const EDGES: Array<[string, string, string]> = [
  ["home", "products", "click Shop"],
  ["home", "search", "submit search"],
  ["products", "detail", "click product"],
  ["detail", "cart", "Add to cart"],
  ["cart", "checkout", "Checkout"],
  ["home", "login", "click Sign in"],
  ["login", "account", "submit credentials"],
  ["account", "settings", "click Settings"],
  ["search", "detail", "click result"],
];

const TICK_MS = 420;

export default function DiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tick, setTick] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const totalTicks = 22;
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

  const visibleNodes = Math.min(NODES.length, Math.ceil(progress * NODES.length * 1.2));
  const visibleEdges = Math.min(EDGES.length, Math.floor(progress * EDGES.length * 1.1));
  const visibleFeed = Math.min(discoveryFeed.length, Math.ceil(progress * discoveryFeed.length));
  const visibleApis = Math.min(apiEndpoints.length, Math.floor(progress * apiEndpoints.length));

  const counters = useMemo(
    () => [
      { label: "Pages found", value: Math.round(progress * discoveryStats.pages) },
      { label: "Journeys", value: Math.round(progress * discoveryStats.journeys) },
      { label: "API endpoints", value: Math.round(progress * discoveryStats.apis) },
    ],
    [progress],
  );

  const elapsed = Math.round((tick * TICK_MS) / 1000);
  const nodeById = (nid: string) => NODES.find((n) => n.id === nid)!;

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="border-muted flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {done ? (
            <Chip tone="success">
              <Check size={12} aria-hidden="true" />
              Complete
            </Chip>
          ) : (
            <Chip tone="error">
              <span className="bg-error-icon h-1.5 w-1.5 animate-pulse rounded-full" />
              LIVE
            </Chip>
          )}
          <span className="text-label-md text-primary truncate">{project.url}</span>
        </div>

        <span className="text-body-sm text-tertiary tabular ml-auto">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")} elapsed
        </span>

        {done && (
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
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
          </div>
        ))}
      </div>

      {/* ---- Graph + rails ---- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Graph canvas */}
        <div className="border-muted relative min-h-80 overflow-hidden border-r">
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
              <p className="text-caption text-primary whitespace-nowrap">{node.label}</p>
            </div>
          ))}

          {done && (
            <div className="absolute inset-x-0 bottom-0 p-5">
              <Card className="mx-auto max-w-md">
                <p className="text-heading-sm text-primary">Discovery complete</p>
                <p className="text-body-md text-tertiary mt-1">
                  {discoveryStats.pages} pages, {discoveryStats.journeys} journeys and {discoveryStats.apis} API
                  endpoints mapped in {elapsed} seconds.
                </p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/projects/${id}/map`} className="flex-1">
                    <Button className="w-full">View application map</Button>
                  </Link>
                  <Link href={`/projects/${id}/plan`} className="flex-1">
                    <Button variant="primary" icon={ArrowRight} className="w-full">
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
                {discoveryFeed.slice(0, visibleFeed).map((line, i) => (
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
                {apiEndpoints.slice(0, visibleApis).map((api) => (
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
