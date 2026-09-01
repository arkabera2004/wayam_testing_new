"use client";

import { useState } from "react";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatCard, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { repoBaseline } from "@/lib/demo-data";

/**
 * Ported from AIDLC-Azure's Repo Test Baseline: scan a repository for the
 * Playwright specs that already exist, break each into its steps, and name the
 * journeys nothing covers yet — so generation starts from what is missing
 * rather than duplicating what is there.
 */
export default function RepoBaselinePage() {
  const b = repoBaseline;
  const [open, setOpen] = useState<string>(b.tests[0].id);
  const totalSteps = b.tests.reduce((n, t) => n + t.steps.length, 0);

  return (
    <PageBody>
      <PageHeader
        title="Repo Test Baseline"
        description={`What ${b.repo} already tests, read straight from the specs on ${b.branch}.`}
        actions={
          <ActionButton icon="refresh" title="Re-scanning repository" body={`Reading specs on ${b.branch}.`}>
            Re-scan
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Existing tests" value={String(b.tests.length)} />
        <StatCard label="Spec files" value={String(b.specFiles)} />
        <StatCard label="Suites" value={String(b.suites)} />
        <StatCard label="Coverage gaps" value={String(b.gaps.length)} delta="uncovered journeys" deltaTone="error" />
      </div>

      <p className="text-caption text-quaternary mt-3">
        {b.framework} · scanned {b.scannedAt} · {totalSteps} steps parsed
      </p>

      {/* ---- Gaps ---- */}
      <Card
        className="mt-5"
        title="Journeys with no coverage"
        subtitle="Discovered by the crawl, absent from the existing specs"
        padded={false}
      >
        <ul className="divide-muted flex flex-col divide-y">
          {b.gaps.map((g) => (
            <li key={g.journey} className="flex items-start gap-3 px-4 py-3">
              <AppIcon name="warning" size="sm" className="text-warning mt-0.5" />
              <div className="min-w-0">
                <p className="text-label-md text-primary">{g.journey}</p>
                <p className="text-body-sm text-tertiary mt-0.5">{g.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* ---- Existing specs ---- */}
      <Card className="mt-5" title="Existing specs" padded={false}>
        <ul className="divide-muted flex flex-col divide-y">
          {b.tests.map((t) => {
            const isOpen = open === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? "" : t.id)}
                  aria-expanded={isOpen}
                  className="hover:bg-raised flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[170ms]"
                >
                  <AppIcon name={isOpen ? "chevronDown" : "chevronRight"} size="sm" className="icon-quaternary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-label-md text-primary truncate">{t.name}</p>
                    <p className="text-caption text-quaternary mt-0.5 font-mono">{t.file}</p>
                  </div>
                  <Chip>{t.suite}</Chip>
                  <span className="text-caption text-quaternary tabular shrink-0">{t.steps.length} steps</span>
                </button>

                {isOpen && (
                  <ol className="border-muted bg-raised/40 flex flex-col gap-1.5 border-t px-4 py-3">
                    {t.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="text-caption text-quaternary tabular mt-0.5 w-4 shrink-0">{i + 1}.</span>
                        <div className="min-w-0">
                          <span className="text-label-sm text-secondary font-mono">{s.action}</span>{" "}
                          <span className="text-body-sm text-tertiary">{s.target}</span>
                          {s.value && <span className="text-body-sm text-quaternary"> → &ldquo;{s.value}&rdquo;</span>}
                          {s.assertion && (
                            <p className="text-body-sm text-success mt-0.5">✓ {s.assertion}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </PageBody>
  );
}
