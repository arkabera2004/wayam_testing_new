import { AppIcon } from "@/components/ui/app-icon";

import { PageBody } from "@/components/layout/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { Button, Card, Chip, PageHeader, Sparkline, StatCard, cn } from "@/components/ui";
import { notFound } from "next/navigation";

import { coverageByPage, projectAnalytics, releaseGate, resolveProject, rootCauseAnalysis } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

/** Confidence bands stand in for a percentage the snapshots do not record. */
const CONFIDENCE_VALUE: Record<string, number> = { high: 90, medium: 60, low: 25 };

function heatTone(value: number) {
  if (value >= 80) return "bg-success-surface text-success border-success-stroke/40";
  if (value >= 55) return "bg-warning-surface text-warning border-warning-stroke/40";
  return "bg-error-surface text-error border-error-stroke/40";
}

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const a = await projectAnalytics(userId, project.id);
  const coverage = await coverageByPage(userId, project.id);
  const gate = await releaseGate(userId, project.id);

  // Clusters come from the same grouping the Root Cause screen uses, so the
  // two screens cannot disagree about why things are failing.
  const { groups } = await rootCauseAnalysis(userId, project.id);
  const failureClusters = groups.map((g) => ({
    name: g.category,
    tests: g.tests.length,
    cause: (g.latest.errorMessage ?? "No error message recorded.").split("\n")[0].slice(0, 160),
  }));

  return (
    <PageBody>
      <PageHeader
        title="Analytics"
        description={`Reliability across ${a.totalRuns} recorded run${a.totalRuns === 1 ? "" : "s"}.`}
        actions={
          <>
            <select
              aria-label="Date range"
              className="border-muted bg-container text-label-md text-secondary h-8 rounded-lg border px-2.5 focus-visible:outline-none"
            >
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>Last 90 days</option>
            </select>
            <ActionButton icon="download" tone="success" title="Export queued" body="A CSV of the last 30 days will download when ready.">Export</ActionButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pass rate"
          value={a.passRate === null ? "No runs yet" : `${a.passRate}%`}
          delta={a.totalResults ? `${a.totalResults} results` : undefined}
          deltaTone={a.passRate !== null && a.passRate >= 95 ? "success" : undefined}
          trend={a.passRateTrend}
        />
        <StatCard label="Runs" value={String(a.totalRuns)} delta="recorded" />
        <StatCard
          label="Average run"
          value={a.avgDurationMs ? `${(a.avgDurationMs / 1000).toFixed(1)}s` : "-"}
          delta="summed spec time"
          trend={a.durationTrend}
        />
        {/* Routes a spec navigates to, over routes the crawl found. It is a
            reach figure, not an assertion figure: a page a spec merely passes
            through counts, so this reads higher than what the suite actually
            checks. The label says "routes reached" rather than "coverage" for
            that reason. Nothing crawled means nothing to divide by. */}
        <StatCard
          label="Routes reached"
          value={
            coverage.length
              ? `${Math.round((coverage.filter((p) => p.covered).length / coverage.length) * 100)}%`
              : "-"
          }
          delta={
            coverage.length
              ? `${coverage.filter((p) => p.covered).length} of ${coverage.length} pages`
              : "nothing crawled yet"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Pass rate and test count"
          subtitle={`One point per run · ${a.totalRuns} runs`}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-label-sm text-tertiary">Pass rate per run</span>
                <span className="text-label-sm text-success tabular">
                  {a.passRate === null ? "-" : `${a.passRate}%`}
                </span>
              </div>
              <Sparkline values={a.passRateTrend} tone="success" className="mt-1.5 h-16" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-label-sm text-tertiary">Run duration (s)</span>
                <span className="text-label-sm text-secondary tabular">
                  {a.avgDurationMs ? `${(a.avgDurationMs / 1000).toFixed(1)}s avg` : "-"}
                </span>
              </div>
              <Sparkline values={a.durationTrend} className="mt-1.5 h-16" />
            </div>
          </div>
        </Card>

        <Card title="Quality gate" subtitle="Branch: main">
          <div className="flex items-center gap-2.5">
            <span className="bg-success-surface text-success grid h-8 w-8 place-items-center rounded-full">
              <AppIcon name="check" size="sm" aria-hidden="true" />
            </span>
            <div>
              <p className="text-heading-sm text-primary">
                {gate.verdict === "GO" ? "Passing" : gate.verdict === "NO-GO" ? "Blocked" : "Conditional"}
              </p>
              <p className="text-body-sm text-tertiary">
                {gate.verdict === "GO" ? "Merges allowed" : `${gate.conditions.length} condition(s) open`}
              </p>
            </div>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {/* The rules are the checks the gate actually applies, reported
                with their current state rather than as fixed policy text. */}
            {[
              `Latest run pass rate: ${gate.passRate === null ? "no runs" : `${gate.passRate}%`}`,
              `${gate.stillQuarantined} test(s) quarantined and excluded`,
              `${gate.awaitingReview} healed locator(s) awaiting review`,
            ].map((rule) => (
              <li key={rule} className="text-body-md text-secondary flex items-start gap-2">
                <AppIcon name="check" size="xs" className="text-success mt-1 shrink-0" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Coverage heatmap" subtitle="Each tile is a crawled page, shaded by coverage confidence">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {coverage.map((p) => {
            const value = p.covered ? (CONFIDENCE_VALUE[p.confidence] ?? 25) : 0;
            return (
              <div
                key={p.path}
                className={cn("rounded-lg border px-3 py-2.5", heatTone(value))}
              >
                <p className="text-label-md truncate">{p.covered ? `${p.mappedTests} test(s)` : "Uncovered"}</p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-caption truncate opacity-70">{p.path}</span>
                  <span className="text-label-sm tabular shrink-0">{value}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <AppIcon name="sparkle" size="sm" className="text-warning" aria-hidden="true" />
            Failure clusters
          </span>
        }
        subtitle="Failures grouped by shared root cause"
      >
        <div className="flex flex-col gap-3">
          {failureClusters.length === 0 && (
            <p className="text-body-md text-tertiary">
              No failures recorded, so there is nothing to group.
            </p>
          )}
          {failureClusters.map((cluster) => (
            <div
              key={cluster.name}
              className="border-muted flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <span className="text-label-md text-primary">{cluster.name}</span>
              <Chip tone="error">{cluster.tests} tests</Chip>
              <span className="text-body-sm text-tertiary min-w-0 flex-1">{cluster.cause}</span>
            </div>
          ))}
        </div>
      </Card>
    </PageBody>
  );
}
