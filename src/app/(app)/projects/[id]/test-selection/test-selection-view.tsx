"use client";

import Link from "next/link";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatCard, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
export type Selection = {
  oldSha: string | null;
  newSha: string | null;
  diffAvailable: boolean;
  changedFiles: string[];
  selected: Array<{ id: string; name: string; priority: string | null; why: string }>;
  skippedSample: Array<{ id: string; name: string; why: string }>;
  summary: { total: number; selected: number; skipped: number; savingsPct: number };
};

/**
 * Ported from AIDLC-Azure's Intelligent Test Selection: map the changed files
 * to the tests that actually cover them, say why each was picked, and run only
 * those. The changed-file set is stored per selection; which tests it picks is
 * derived from the live suite each time, so the reasons stay true as the suite
 * changes rather than going stale in a table.
 */
const PRIORITY: Record<string, { tone: string; surface: string }> = {
  critical: { tone: "text-error", surface: "bg-error-surface" },
  high: { tone: "text-warning", surface: "bg-warning-surface" },
  medium: { tone: "text-info", surface: "bg-info-surface" },
  low: { tone: "text-tertiary", surface: "bg-raised" },
};

export function TestSelectionView({ id, selection: s }: { id: string; selection: Selection }) {

  return (
    <PageBody>
      <PageHeader
        title="Test Selection"
        description="Skip the full suite. Parikshan maps changed files to the tests that cover them, explains why, and runs only what matters."
        actions={
          <ActionButton
            icon="play"
            variant="primary"
            title="Running selected tests"
            body={`${s.summary.selected} of ${s.summary.total} specs queued.`}
          >
            Run selected
          </ActionButton>
        }
      />

      {/* ---- Change under analysis ---- */}
      <Card title="Current change" subtitle={`${s.oldSha} → ${s.newSha}`}>
        <div className="flex flex-wrap gap-1.5">
          {s.changedFiles.map((f) => (
            <span key={f} className="text-caption text-secondary bg-raised rounded-lg px-2 py-1 font-mono">
              {f}
            </span>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tests" value={String(s.summary.total)} />
        <StatCard label="Selected" value={String(s.summary.selected)} delta="runs" deltaTone="success" />
        <StatCard label="Skipped" value={String(s.summary.skipped)} />
        <StatCard label="Estimated saving" value={`${s.summary.savingsPct}%`} delta="of suite time" deltaTone="success" />
      </div>

      {!s.diffAvailable && (
        <div className="border-warning-stroke/30 bg-warning-surface mt-4 rounded-xl border p-4">
          <p className="text-body-sm text-secondary">
            No commit diff was available, so the full suite was selected as a safe fallback.
          </p>
        </div>
      )}

      {/* ---- Selected ---- */}
      <Card
        className="mt-5"
        title="Selected tests"
        subtitle="Each one traced back to a file in the diff"
        padded={false}
      >
        <ul className="divide-muted flex flex-col divide-y">
          {s.selected.map((t) => {
            const p = PRIORITY[t.priority ?? "low"] ?? PRIORITY.low;
            return (
              <li key={t.id} className="hover:bg-raised transition-colors duration-[170ms]">
                <Link href={`/projects/${id}/tests/${t.id}`} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn("text-label-sm mt-0.5 shrink-0 rounded-full px-2 py-0.5", p.surface, p.tone)}>
                    {t.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-label-md text-primary">{t.name}</p>
                    <p className="text-body-sm text-tertiary mt-1">{t.why}</p>
                  </div>
                  <AppIcon name="chevronRight" size="sm" className="icon-quaternary mt-1" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ---- Skipped ---- */}
      <Card
        className="mt-5"
        title={`Skipped (${s.summary.skipped})`}
        subtitle="Nothing in the diff reaches these paths"
        padded={false}
      >
        <ul className="divide-muted flex flex-col divide-y">
          {s.skippedSample.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <p className="text-label-md text-secondary">{t.name}</p>
              <p className="text-body-sm text-quaternary mt-1">{t.why}</p>
            </li>
          ))}
          <li className="text-body-sm text-quaternary px-4 py-3">
            and {s.summary.skipped - s.skippedSample.length} more.
          </li>
        </ul>
      </Card>
    </PageBody>
  );
}
