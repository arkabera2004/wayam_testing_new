"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Wrench, X } from "lucide-react";

import { Button, Card, Chip, StatusBadge, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { executionCells, generatedTests, runs } from "@/lib/demo-data";

const CELL_INTERVAL = 340;

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = use(params);
  const run = runs.find((r) => String(r.id) === runId) ?? runs[0];

  /** Cells resolve one by one so the grid "lights up" during the demo. */
  const [resolved, setResolved] = useState(0);
  const [healToast, setHealToast] = useState(false);

  useEffect(() => {
    if (resolved >= executionCells.length) {
      const t = setTimeout(() => setHealToast(true), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setResolved((r) => r + 1), CELL_INTERVAL);
    return () => clearTimeout(t);
  }, [resolved]);

  const finished = resolved >= executionCells.length;
  const passedSoFar = executionCells
    .slice(0, resolved)
    .filter((c) => c.status === "passed").length;
  const failedSoFar = executionCells
    .slice(0, resolved)
    .filter((c) => c.status === "failed").length;

  const failedTest = generatedTests.find((t) => t.status === "failed")!;
  const sorted = [failedTest, ...generatedTests.filter((t) => t.status !== "failed")];

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="border-muted flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-4">
        <h1 className="text-heading-md text-primary tabular">Run #{run.id}</h1>
        {finished ? (
          <StatusBadge status="failed" label="1 failed" />
        ) : (
          <StatusBadge status="running" />
        )}
        <Chip>{run.trigger}</Chip>
        <span className="text-body-sm text-tertiary">{run.branch}</span>
        <span className="text-body-sm text-quaternary tabular ml-auto">{run.duration}</span>

        <div className="flex gap-2">
          {finished ? (
            <ActionButton icon="refresh" title="Re-run queued" body="The suite will start on the same commit.">Re-run failed</ActionButton>
          ) : (
            <ActionButton icon="close" tone="warning" title="Run cancelled" body="Remaining shards were stopped.">Cancel run</ActionButton>
          )}
        </div>
      </header>

      {/* ---- Live summary ---- */}
      <div className="border-muted flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-5 py-3">
        <span className="text-label-md text-success tabular">Passed {passedSoFar * 5 + 1}</span>
        <span className="text-label-md text-error tabular">Failed {failedSoFar}</span>
        <span className="text-label-md text-tertiary tabular">Skipped 0</span>
        <span className="text-body-sm text-quaternary ml-auto">
          {finished ? "Completed" : "ETA 00:18"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* ---- Parallel grid ---- */}
          <section>
            <h2 className="text-label-sm text-tertiary mb-3">Parallel execution</h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {executionCells.map((cell, i) => {
                const done = i < resolved;
                const status = done ? cell.status : "queued";
                return (
                  <div
                    key={`${cell.browser}-${cell.shard}`}
                    className={cn(
                      "rounded-xl border p-3.5 transition-[background-color,border-color] duration-200 ease-out",
                      !done && "border-muted bg-container",
                      done && cell.status === "passed" && "border-success-stroke/40 bg-success-surface",
                      done && cell.status === "failed" && "border-error-stroke/50 bg-error-surface",
                      done && cell.status === "running" && "border-info-stroke/40 bg-info-surface",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label-md text-primary">
                        {cell.browser}
                        <span className="text-quaternary"> · shard {cell.shard}</span>
                      </span>
                      <StatusBadge status={status} />
                    </div>

                    <div className="bg-raised mt-3 h-1 w-full overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300 ease-out",
                          cell.status === "failed" ? "bg-error-icon" : "bg-success-icon",
                        )}
                        style={{ width: done ? "100%" : "0%" }}
                      />
                    </div>

                    <p className="text-caption text-quaternary mt-2 truncate">
                      &rarr; {cell.line}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- Results ---- */}
          <Card title="Results" padded={false}>
            <ul>
              {sorted.map((t, i) => {
                const isFailed = t.status === "failed";
                const body = (
                  <span
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      isFailed && "bg-error-surface",
                    )}
                  >
                    <StatusBadge status={t.status} />
                    <span className="text-body-md text-primary min-w-0 flex-1 truncate">
                      {t.name}
                    </span>
                    <span className="text-body-sm text-quaternary tabular shrink-0">
                      {t.duration}
                    </span>
                    {isFailed ? (
                      <ChevronRight size={14} className="icon-tertiary shrink-0" aria-hidden="true" />
                    ) : null}
                  </span>
                );

                return (
                  <li key={t.id} className={cn(i > 0 && "border-muted border-t")}>
                    {isFailed ? (
                      <Link
                        href={`/projects/${id}/runs/${run.id}/results/${t.id}`}
                        className="block"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      {/* ---- Self-healing toast (demo scene 8 payoff) ---- */}
      {healToast && (
        <div
          role="status"
          className="border-info-stroke/50 bg-container fixed right-5 bottom-5 z-40 flex w-full max-w-sm gap-3 rounded-xl border p-4"
        >
          <span className="bg-info-surface text-info grid h-8 w-8 shrink-0 place-items-center rounded-full">
            <Wrench size={15} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-heading-sm text-primary">A locator changed</p>
            <p className="text-body-md text-tertiary mt-1">
              Parikshan updated the selector automatically. Tests stay green.
            </p>
            <Link href={`/projects/${id}/healing`} className="mt-3 inline-block">
              <Button size="sm">Review the change</Button>
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setHealToast(false)}
            aria-label="Dismiss"
            className="icon-quaternary hover:icon-secondary grid h-6 w-6 shrink-0 place-items-center rounded"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
