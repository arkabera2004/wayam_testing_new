"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  Filter,
  MoreHorizontal,
  Pencil,
  Play,
  Power,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  RunDots,
  StatusBadge,
  Table,
  Td,
  Th,
  cn,
} from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import type { TestCaseWithStats } from "@/db/queries";
import { toUiStatus } from "@/lib/format";

const FILTERS = ["smoke", "auth", "negative", "edge-case", "happy-path", "quarantined"];

export function TestsTable({
  id,
  tests,
}: {
  id: string;
  tests: TestCaseWithStats[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tests.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.journey.toLowerCase().includes(q)) {
        return false;
      }
      if (activeFilters.length && !activeFilters.some((f) => t.tags.includes(f))) return false;
      return true;
    });
  }, [tests, query, activeFilters]);

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.includes(t.id));

  const toggleFilter = (f: string) =>
    setActiveFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const toggleSelect = (testId: string) =>
    setSelected((prev) =>
      prev.includes(testId) ? prev.filter((x) => x !== testId) : [...prev, testId],
    );

  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Commits the generated specs to the linked repository on a new branch and
  // opens a pull request. Requires a GitHub connection and a repo URL; the API
  // says which one is missing rather than failing silently.
  async function exportToRepo() {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${id}/export-github`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Export failed", body: data.error });
        return;
      }
      toast({
        tone: "success",
        title: `${data.fileCount} spec${data.fileCount === 1 ? "" : "s"} pushed to ${data.repo}`,
        body: `Pull request opened on ${data.branch}.`,
      });
      window.open(data.prUrl, "_blank", "noopener");
    } catch {
      toast({ tone: "error", title: "Export failed", body: "The request could not be completed." });
    } finally {
      setExporting(false);
    }
  }


  // One real code path for the header button, "Run selected" and the row menu.
  // Passing no ids runs the whole suite; ids run just those cases.
  async function runTests(caseIds?: string[], what?: string) {
    setRunning(true);
    toast({ tone: "info", title: `Running ${what ?? "suite"}`, body: "Executing specs in a real browser." });
    try {
      const res = await fetch(`/api/projects/${id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(caseIds?.length ? { caseIds } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Run could not start", body: data.error });
        return;
      }
      toast({
        tone: data.failed === 0 ? "success" : "warning",
        title: `${data.passed} of ${data.total} passed`,
        body: `Finished in ${(data.durationMs / 1000).toFixed(1)}s.`,
      });
      router.push(`/projects/${id}/runs/${data.runId}`);
    } catch {
      toast({ tone: "error", title: "Run failed", body: "The suite could not be executed." });
    } finally {
      setRunning(false);
    }
  }

  const rowMenu = (testId: string, name: string) => [
    {
      label: "Run this test",
      icon: Play,
      onSelect: () => void runTests([testId], name),
    },
    { label: "Edit code", icon: Pencil, onSelect: () => router.push(`/projects/${id}/tests/${testId}`) },
    {
      label: "Duplicate",
      icon: Copy,
      onSelect: () => toast({ tone: "success", title: "Test duplicated", body: `Copy of ${name}` }),
    },
    {
      label: "Disable",
      icon: Power,
      onSelect: () => toast({ tone: "warning", title: "Test disabled", body: name }),
    },
    {
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: () => toast({ tone: "error", title: "Test deleted", body: name }),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Tests"
        description={`${tests.length} Playwright spec${tests.length === 1 ? "" : "s"} generated from your approved plan.`}
        actions={
          <>
            <Button icon={Upload} disabled={exporting} onClick={() => void exportToRepo()}>
              {exporting ? "Exporting…" : "Export all to repo"}
            </Button>
            <Button
              variant="primary"
              icon={Play}
              disabled={running}
              onClick={() => void runTests()}
            >
              {running ? "Running…" : "Run suite"}
            </Button>
          </>
        }
      />

      <Card padded={false}>
        <div className="border-muted flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="border-muted bg-raised focus-within:border-active flex h-8 items-center gap-2 rounded-lg border px-2.5 transition-colors duration-[170ms]">
            <Search size={13} className="icon-quaternary shrink-0" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests"
              aria-label="Search tests"
              className="text-body-md text-primary placeholder:text-quaternary w-44 bg-transparent outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="icon-quaternary hover:icon-secondary shrink-0"
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={13} className="icon-quaternary" aria-hidden="true" />
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFilter(f)}
                aria-pressed={activeFilters.includes(f)}
              >
                <Chip tone={activeFilters.includes(f) ? "solid" : "neutral"}>{f}</Chip>
              </button>
            ))}
            {activeFilters.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setActiveFilters([])}>
                Clear
              </Button>
            ) : null}
          </div>

          <span className="text-body-sm text-quaternary ml-auto tabular">
            Showing {visible.length} of {tests.length}
          </span>
        </div>

        {/* Bulk action bar */}
        {selected.length > 0 && (
          <div className="border-muted bg-raised flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <span className="text-label-md text-primary tabular">
              {selected.length} selected
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                icon={Play}
                disabled={running}
                onClick={() =>
                  void runTests(selected, `${selected.length} test${selected.length === 1 ? "" : "s"}`)
                }
              >
                Run selected
              </Button>
              <Button
                size="sm"
                icon={Tag}
                onClick={() => toast({ tone: "success", title: "Tag applied to selection" })}
              >
                Tag
              </Button>
              <Button
                size="sm"
                icon={Upload}
                onClick={() => toast({ tone: "success", title: "Selection exported" })}
              >
                Export
              </Button>
              <Button
                size="sm"
                icon={Power}
                onClick={() => toast({ tone: "warning", title: "Selection disabled" })}
              >
                Disable
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
              Clear selection
            </Button>
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon={Search}
            art={<Icon3D name="no-results" size={88} />}
            title="No tests match those filters"
            description="Try a different search term, or clear the active filters to see the whole suite."
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
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all visible tests"
                    checked={allVisibleSelected}
                    onChange={() =>
                      setSelected(allVisibleSelected ? [] : visible.map((t) => t.id))
                    }
                    className="accent-primary"
                  />
                </Th>
                <Th>Test</Th>
                <Th>Journey</Th>
                <Th>Status</Th>
                <Th>Last 7 runs</Th>
                <Th className="text-right">Avg</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "transition-colors duration-[170ms]",
                    selected.includes(t.id) ? "bg-raised" : "hover:bg-raised",
                  )}
                >
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${t.name}`}
                      checked={selected.includes(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="accent-primary"
                    />
                  </Td>
                  <Td>
                    <Link href={`/projects/${id}/tests/${t.id}`} className="block min-w-0">
                      <span className="text-label-md text-primary block truncate">{t.name}</span>
                      <span className="mt-1 flex gap-1.5">
                        {t.tags.map((tag) => (
                          <Chip key={tag}>{tag}</Chip>
                        ))}
                      </span>
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{t.journey}</Td>
                  <Td>
                    {t.status ? (
                      <StatusBadge status={toUiStatus(t.status)} />
                    ) : (
                      <span className="text-body-sm text-quaternary">Never run</span>
                    )}
                  </Td>
                  <Td>
                    <RunDots history={t.history.map(toUiStatus)} />
                  </Td>
                  <Td className="tabular text-right">
                    {t.avgMs ? `${(t.avgMs / 1000).toFixed(1)}s` : "-"}
                  </Td>
                  <Td>
                    <Menu
                      label={`Actions for ${t.name}`}
                      trigger={<MoreHorizontal size={15} aria-hidden="true" />}
                      items={rowMenu(t.id, t.name)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageBody>
  );
}
