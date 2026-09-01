"use client";

import { use } from "react";
import Link from "next/link";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, Chip, PageHeader, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { releaseGate, type GateVerdict } from "@/lib/demo-data";
import type { IconName } from "@/lib/icons";

/**
 * Ported from AIDLC-Azure's Release Gate: a composite readiness score over CI
 * results, open bugs and security findings, resolved into a go / no-go call.
 * The original drove this from a live evaluation endpoint; here the signals
 * come from the demo dataset, so the shape is preserved but the verdict is
 * fixed.
 */
const VERDICT: Record<
  GateVerdict,
  { icon: IconName; text: string; surface: string; border: string; label: string }
> = {
  GO: {
    icon: "check",
    text: "text-success",
    surface: "bg-success-surface",
    border: "border-success-stroke/40",
    label: "Cleared to ship",
  },
  "NO-GO": {
    icon: "close",
    text: "text-error",
    surface: "bg-error-surface",
    border: "border-error-stroke/40",
    label: "Blocked",
  },
  CONDITIONAL: {
    icon: "warning",
    text: "text-warning",
    surface: "bg-warning-surface",
    border: "border-warning-stroke/40",
    label: "Ship with conditions",
  },
};

/** Semicircular gauge. Stroke-dash on a half circle keeps it dependency-free. */
function ScoreGauge({ score }: { score: number }) {
  const tone = score >= 75 ? "var(--feedback-success-icon)" : score >= 50 ? "var(--feedback-warning-icon)" : "var(--feedback-error-icon)";
  const r = 68;
  const half = Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * half;

  return (
    <div className="relative shrink-0" style={{ width: 176, height: 104 }}>
      <svg width={176} height={104} viewBox="0 0 176 104" aria-hidden="true">
        <path
          d="M20 92 A68 68 0 0 1 156 92"
          fill="none"
          stroke="var(--surface-raised-x2)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d="M20 92 A68 68 0 0 1 156 92"
          fill="none"
          stroke={tone}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${half}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <span className="font-display text-display-metric text-primary tabular leading-none">{score}</span>
        <span className="text-caption text-tertiary mt-1">of 100</span>
      </div>
    </div>
  );
}

function Signal({
  icon,
  label,
  value,
  hint,
  tone,
  children,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-muted bg-container rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <AppIcon name={icon} size="sm" className={tone} />
        <span className="text-label-sm text-tertiary">{label}</span>
      </div>
      <p className={cn("font-display text-display-sm tabular mt-2", tone)}>{value}</p>
      <p className="text-caption text-quaternary mt-1">{hint}</p>
      {children}
    </div>
  );
}

export default function ReleaseGatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const g = releaseGate;
  const v = VERDICT[g.verdict];

  return (
    <PageBody>
      <PageHeader
        title="Release Gate"
        description="A composite readiness score over CI results, open bugs and security findings."
        actions={
          <ActionButton
            icon="refresh"
            title="Re-evaluating gate"
            body={`Recomputing readiness for ${g.version}.`}
          >
            Re-evaluate
          </ActionButton>
        }
      />

      {/* ---- Verdict ---- */}
      <Card padded={false}>
        <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-caption text-quaternary">Release {g.version}</p>

            <div className={cn("mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5", v.surface, v.border)}>
              <AppIcon name={v.icon} size="md" className={v.text} />
              <span className={cn("text-heading-sm", v.text)}>{g.verdict}</span>
              <span className="text-body-sm text-tertiary">· {v.label}</span>
            </div>

            <p className="text-body-md text-secondary mt-3 max-w-2xl">{g.recommendation}</p>

            <div className="border-error-stroke/30 bg-error-surface mt-4 rounded-lg border p-3">
              <p className="text-label-sm text-error">Primary blocker</p>
              <p className="text-body-md text-secondary mt-1">{g.primaryBlocker}</p>
            </div>

            <div className="mt-4">
              <p className="text-label-sm text-warning">Conditions to resolve</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {g.conditions.map((c) => (
                  <li key={c} className="text-body-md text-secondary flex gap-2">
                    <AppIcon name="chevronRight" size="xs" className="icon-quaternary mt-1" />
                    <span className="min-w-0">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 lg:pt-4">
            <ScoreGauge score={g.score} />
            <Chip tone="neutral">{Math.round(g.confidence * 100)}% confidence</Chip>
          </div>
        </div>
      </Card>

      {/* ---- Signals ---- */}
      <section className="mt-5">
        <h2 className="text-heading-sm text-primary">Signal breakdown</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Signal
            icon="check"
            label="CI pass rate"
            value={`${g.signals.testPassRate}%`}
            hint={`across the last ${g.signals.recentEvaluated} runs`}
            tone="text-success"
          />
          <Signal
            icon="quarantine"
            label="Open critical bugs"
            value={String(g.signals.openCriticalBugs.length)}
            hint="blocking this tag"
            tone="text-error"
          >
            <ul className="mt-2 flex flex-col gap-1">
              {g.signals.openCriticalBugs.map((b) => (
                <li key={b.key} className="text-caption text-quaternary truncate">
                  <span className="text-tertiary">{b.key}</span> — {b.summary}
                </li>
              ))}
            </ul>
          </Signal>
          <Signal
            icon="warning"
            label="Security findings"
            value={String(g.signals.unresolvedSecurityFindings)}
            hint="unresolved"
            tone="text-warning"
          />
          <Signal
            icon="trend"
            label="Verdict confidence"
            value={`${Math.round(g.confidence * 100)}%`}
            hint="how sure the gate is"
            tone="text-info"
          />
        </div>
      </section>

      {g.warnings.length > 0 && (
        <div className="border-warning-stroke/30 bg-warning-surface mt-5 rounded-xl border p-4">
          <p className="text-label-sm text-warning">Partial data</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {g.warnings.map((w) => (
              <li key={w} className="text-body-sm text-secondary">{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/projects/${id}/code-review`}>
          <Button icon={undefined}>Review the blocking commit</Button>
        </Link>
        <Link href={`/projects/${id}/runs/137`}>
          <Button variant="ghost">Open the last run</Button>
        </Link>
      </div>
    </PageBody>
  );
}
