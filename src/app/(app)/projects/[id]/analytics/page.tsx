import { Check, Download, Sparkles } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, Chip, PageHeader, Sparkline, StatCard, cn } from "@/components/ui";
import {
  coverageTrend,
  discoveredPages,
  failureClusters,
  passRateTrend,
  project,
} from "@/lib/demo-data";

/** Deterministic coverage per page so the heatmap is stable across renders. */
function coverageFor(path: string) {
  const seed = path.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 30 + (seed % 71);
}

function heatTone(value: number) {
  if (value >= 80) return "bg-success-surface text-success border-success-stroke/40";
  if (value >= 55) return "bg-warning-surface text-warning border-warning-stroke/40";
  return "bg-error-surface text-error border-error-stroke/40";
}

export default function AnalyticsPage() {
  return (
    <PageBody>
      <PageHeader
        title="Analytics"
        description="Coverage, reliability and triage speed over the last 30 days."
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
            <Button icon={Download}>Export</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pass rate (30d)" value="97.6%" delta="+1.2" deltaTone="success" trend={passRateTrend} />
        <StatCard label="Flaky rate" value="1.4%" delta="-0.6" deltaTone="success" trend={[3, 2.8, 2.5, 2.2, 2, 1.8, 1.6, 1.4]} />
        <StatCard label="Mean time to triage" value="4m 12s" delta="-38%" deltaTone="success" trend={[12, 11, 9, 8, 7, 6, 5, 4]} />
        <StatCard label="Coverage" value={`${project.coverage}%`} delta="+4" deltaTone="success" trend={coverageTrend} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Pass rate and test count"
          subtitle="Dual axis, last 12 weeks"
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-label-sm text-tertiary">Pass rate</span>
                <span className="text-label-sm text-success tabular">97.6%</span>
              </div>
              <Sparkline values={passRateTrend} tone="success" className="mt-1.5 h-16" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-label-sm text-tertiary">Coverage</span>
                <span className="text-label-sm text-secondary tabular">{project.coverage}%</span>
              </div>
              <Sparkline values={coverageTrend} className="mt-1.5 h-16" />
            </div>
          </div>
        </Card>

        <Card title="Quality gate" subtitle="Branch: main">
          <div className="flex items-center gap-2.5">
            <span className="bg-success-surface text-success grid h-8 w-8 place-items-center rounded-full">
              <Check size={15} strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <p className="text-heading-sm text-primary">Passing</p>
              <p className="text-body-sm text-tertiary">Merges allowed</p>
            </div>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {[
              "Block merge if any smoke test fails",
              "Block merge if pass rate drops below 95%",
              "Quarantined tests never block",
            ].map((rule) => (
              <li key={rule} className="text-body-md text-secondary flex items-start gap-2">
                <Check size={13} className="text-success mt-1 shrink-0" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Coverage heatmap" subtitle="Each tile is a discovered page">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {discoveredPages.map((p) => {
            const value = coverageFor(p.path);
            return (
              <div
                key={p.path}
                className={cn("rounded-lg border px-3 py-2.5", heatTone(value))}
              >
                <p className="text-label-md truncate">{p.title}</p>
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
            <Sparkles size={14} className="text-warning" aria-hidden="true" />
            Failure clusters
          </span>
        }
        subtitle="Failures grouped by shared root cause"
      >
        <div className="flex flex-col gap-3">
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
