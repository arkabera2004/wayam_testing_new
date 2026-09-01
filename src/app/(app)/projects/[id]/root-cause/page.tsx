"use client";

import Link from "next/link";
import { use } from "react";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatCard, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { rootCause } from "@/lib/demo-data";

/**
 * Ported from AIDLC-Azure's AI Root Cause Analysis: group failures by cause,
 * state the diagnosis with a confidence score, and keep the not-yet-analysed
 * failures visible so nothing is quietly dropped.
 */
function confidenceTone(pct: number) {
  if (pct >= 80) return "text-success";
  if (pct >= 60) return "text-warning";
  return "text-tertiary";
}

export default function RootCausePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const r = rootCause;

  return (
    <PageBody>
      <PageHeader
        title="Root Cause Analysis"
        description="Every failure traced to a cause, with the evidence and a confidence score behind each diagnosis."
        actions={
          <ActionButton icon="sparkle" title="Analysing failures" body={`${r.unanalysed.length} failures queued for diagnosis.`}>
            Analyse pending
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total failures" value={String(r.summary.totalFailures)} />
        <StatCard label="Causes identified" value={String(r.summary.identified)} deltaTone="success" />
        <StatCard label="High confidence" value={String(r.summary.highConfidence)} delta="≥ 80%" deltaTone="success" />
        <StatCard label="Unresolved" value={String(r.summary.unresolved)} deltaTone="error" />
      </div>

      {/* ---- Pending ---- */}
      {r.unanalysed.length > 0 && (
        <Card
          className="mt-5"
          title="Not yet analysed"
          subtitle="Failures picked up from recent runs, waiting on a diagnosis"
          padded={false}
        >
          <ul className="divide-muted flex flex-col divide-y">
            {r.unanalysed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <AppIcon name="warning" size="sm" className="text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-label-md text-primary truncate">{f.test}</p>
                  <p className="text-caption text-quaternary mt-0.5">
                    Run #{f.run} · {f.when}
                  </p>
                </div>
                <Link
                  href={`/projects/${id}/runs/${f.run}`}
                  className="text-label-sm text-secondary hover:text-primary shrink-0"
                >
                  Open run
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---- Diagnosed ---- */}
      <div className="mt-5 flex flex-col gap-4">
        {r.analysed.map((a) => (
          <Card key={a.id} padded={false}>
            <div className="border-muted flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Chip tone="neutral">{a.category}</Chip>
              <span className="text-label-md text-primary min-w-0 flex-1 truncate">{a.test}</span>
              <span className={cn("text-label-sm tabular", confidenceTone(a.confidence))}>
                {a.confidence}% confidence
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div>
                <p className="text-label-sm text-tertiary">Cause</p>
                <p className="text-body-md text-secondary mt-1">{a.cause}</p>
              </div>
              <div className="bg-raised rounded-lg px-3 py-2">
                <p className="text-body-sm text-secondary">
                  <span className="text-success">Recommended fix — </span>
                  {a.fix}
                </p>
              </div>
              <div className="text-caption text-quaternary flex flex-wrap items-center gap-3">
                <span>Run #{a.run}</span>
                <span>
                  {a.affected} test{a.affected === 1 ? "" : "s"} affected
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageBody>
  );
}
