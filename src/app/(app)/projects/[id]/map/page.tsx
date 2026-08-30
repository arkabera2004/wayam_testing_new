"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileCode2,
  Filter,
  Lock,
  Minus,
  Network,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Button, Card, Chip, EmptyState, Table, Td, Th, cn } from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";
import { apiEndpoints, discoveredPages } from "@/lib/demo-data";

const FILTERS = ["has forms", "auth-gated", "API-backed"];

export default function ApplicationMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<"graph" | "apis">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const page = discoveredPages.find((p) => p.path === selected) ?? null;

  const toggleFilter = (f: string) =>
    setActiveFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const filtered = discoveredPages.filter((p) => {
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
          <Search size={13} className="icon-quaternary shrink-0" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages"
            aria-label="Search pages"
            className="text-body-md text-primary placeholder:text-quaternary w-40 bg-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter size={13} className="icon-quaternary" aria-hidden="true" />
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => toggleFilter(f)}>
              <Chip tone={activeFilters.includes(f) ? "solid" : "neutral"}>{f}</Chip>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Zoom out">
            <Minus size={14} aria-hidden="true" />
          </Button>
          <span className="text-label-sm text-tertiary tabular w-10 text-center">100%</span>
          <Button variant="ghost" size="sm" aria-label="Zoom in">
            <Plus size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* ---- Body ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "graph" && filtered.length === 0 ? (
          <EmptyState
            icon={Search}
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
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
                {/* Screenshot placeholder */}
                <div className="bg-raised border-muted flex aspect-video items-center justify-center rounded-lg border">
                  <div className="w-3/4">
                    <div className="bg-raised-2 h-1.5 w-1/2 rounded-full" />
                    <div className="bg-raised-2 mt-1.5 h-1 w-full rounded-full opacity-60" />
                    <div className="bg-raised-2 mt-1 h-1 w-4/5 rounded-full opacity-40" />
                    <div className="mt-2.5 flex gap-1.5">
                      <div className="bg-raised-2 h-4 flex-1 rounded" />
                      <div className="bg-raised-2 h-4 flex-1 rounded opacity-60" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-label-md text-primary truncate">{p.title}</p>
                    <p className="text-caption text-quaternary truncate">{p.path}</p>
                  </div>
                  {p.gated ? (
                    <Lock size={12} className="icon-quaternary mt-0.5 shrink-0" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {p.forms > 0 ? <Chip>{p.forms} forms</Chip> : null}
                  {p.apis > 0 ? <Chip>{p.apis} APIs</Chip> : null}
                </div>
              </button>
            ))}
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
                  {apiEndpoints.map((api) => (
                    <tr key={`${api.method} ${api.path}`} className="hover:bg-raised transition-colors duration-[170ms]">
                      <Td>
                        <Chip tone={api.method === "GET" ? "info" : "success"}>{api.method}</Chip>
                      </Td>
                      <Td className="text-primary">{api.path}</Td>
                      <Td className="tabular text-right">{api.status}</Td>
                      <Td className="tabular text-quaternary text-right">{api.firstSeen}</Td>
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
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="bg-raised border-muted aspect-video rounded-lg border" />

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
                    <FileCode2 size={13} className="icon-quaternary shrink-0" aria-hidden="true" />
                    {el}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-label-sm text-tertiary">Associated API calls</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {apiEndpoints.slice(0, page.apis).map((api) => (
                  <li key={`${api.method} ${api.path}`} className="flex items-center gap-2">
                    <Network size={13} className="icon-quaternary shrink-0" aria-hidden="true" />
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
              <Button variant="primary" icon={ChevronRight} className="w-full">
                Generate tests for this page
              </Button>
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}
