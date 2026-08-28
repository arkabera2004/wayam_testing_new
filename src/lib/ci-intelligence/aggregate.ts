// Pure aggregation logic for CI Intelligence (ported from aidlc_azure's
// CIIntelligence page/ci_intelligence route), kept separate from Mongo
// plumbing so it's unit-testable — see tests/ci-intelligence-aggregate.test.ts.
//
// Unlike aidlc_azure's version (which reads GitHub Actions workflow runs),
// this reads Parikshan's own test_runs/run_results — real org data already
// in this app, not a re-fetch of an external CI provider.
export interface RunInput {
  trigger: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface ResultInput {
  testCaseId: string;
  scenarioTitle: string;
  status: string;
  durationMs: number;
}

export interface TriggerBreakdown {
  trigger: string;
  totalRuns: number;
  passRate: number;
  avgDurationMs: number;
}

export interface SlowTest {
  scenarioTitle: string;
  avgDurationMs: number;
  runs: number;
}

export interface CiIntelligenceSummary {
  totalRuns: number;
  overallPassRate: number;
  avgDurationMs: number;
  byTrigger: TriggerBreakdown[];
  slowestTests: SlowTest[];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function durationOf(run: RunInput): number | null {
  if (!run.finishedAt) return null;
  return run.finishedAt.getTime() - run.startedAt.getTime();
}

export function computeCiIntelligence(
  runs: RunInput[],
  results: ResultInput[],
): CiIntelligenceSummary {
  const totalRuns = runs.length;
  const overallPassRate =
    totalRuns === 0
      ? 0
      : Math.round((runs.filter((r) => r.status === "passed").length / totalRuns) * 100);
  const avgDurationMs = avg(runs.map(durationOf).filter((d): d is number => d !== null));

  const triggers = Array.from(new Set(runs.map((r) => r.trigger)));
  const byTrigger: TriggerBreakdown[] = triggers
    .map((trigger) => {
      const triggerRuns = runs.filter((r) => r.trigger === trigger);
      const passed = triggerRuns.filter((r) => r.status === "passed").length;
      return {
        trigger,
        totalRuns: triggerRuns.length,
        passRate: triggerRuns.length === 0 ? 0 : Math.round((passed / triggerRuns.length) * 100),
        avgDurationMs: avg(triggerRuns.map(durationOf).filter((d): d is number => d !== null)),
      };
    })
    .sort((a, b) => b.totalRuns - a.totalRuns);

  const byTestCase = new Map<string, { scenarioTitle: string; durations: number[] }>();
  for (const result of results) {
    const entry = byTestCase.get(result.testCaseId) ?? {
      scenarioTitle: result.scenarioTitle,
      durations: [],
    };
    entry.durations.push(result.durationMs);
    byTestCase.set(result.testCaseId, entry);
  }
  const slowestTests: SlowTest[] = Array.from(byTestCase.values())
    .map((entry) => ({
      scenarioTitle: entry.scenarioTitle,
      avgDurationMs: avg(entry.durations),
      runs: entry.durations.length,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5);

  return { totalRuns, overallPassRate, avgDurationMs, byTrigger, slowestTests };
}
