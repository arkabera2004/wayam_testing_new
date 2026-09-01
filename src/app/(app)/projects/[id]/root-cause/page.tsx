import Link from "next/link";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatCard, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { notFound } from "next/navigation";

import { resolveProject, rootCauseAnalysis } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { relativeTime } from "@/lib/format";

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

export default async function RootCausePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const r = await rootCauseAnalysis(userId, project.id);

  return (
    <PageBody>
      <PageHeader
        title="Root Cause Analysis"
        description="Every failure traced to a cause, with the evidence and a confidence score behind each diagnosis."
        actions={
          <ActionButton icon="sparkle" title="Analysing failures" body={`${r.summary.totalFailures} recorded failure(s) regrouped.`}>
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
      
      {/* ---- Diagnosed ---- */}
      <div className="mt-5 flex flex-col gap-4">
        {r.groups.map((a) => (
          <Card key={a.category} padded={false}>
            <div className="border-muted flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Chip tone="neutral">{a.category}</Chip>
              <span className="text-label-md text-primary min-w-0 flex-1 truncate">{a.tests.slice(0, 2).join(", ")}{a.tests.length > 2 ? ` +${a.tests.length - 2} more` : ""}</span>
              <span className={cn("text-label-sm tabular", confidenceTone(a.confidence))}>
                {a.confidence}% confidence
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div>
                <p className="text-label-sm text-tertiary">Cause</p>
                <pre className="text-body-sm text-secondary bg-raised mt-1 max-h-32 overflow-auto rounded-lg p-2.5 font-mono whitespace-pre-wrap">{(a.latest.errorMessage ?? "").split("\n").slice(0, 4).join("\n")}</pre>
              </div>
              <div className="bg-raised rounded-lg px-3 py-2">
                <p className="text-body-sm text-secondary">
                  <span className="text-success">Seen — </span>
                  {a.occurrences} time{a.occurrences === 1 ? "" : "s"} across {a.tests.length} test
                  {a.tests.length === 1 ? "" : "s"}, most recently {relativeTime(a.latest.startedAt)}.
                </p>
              </div>
              <div className="text-caption text-quaternary flex flex-wrap items-center gap-3">
                <span>Run {a.latest.runId.slice(0, 8)}</span>
                <span>
                  {a.tests.length} test{a.tests.length === 1 ? "" : "s"} affected
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageBody>
  );
}
