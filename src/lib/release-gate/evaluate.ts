// Pure Release Gate scoring (ported from aidlc_azure's ReleaseGate page/
// release_gate route — see that route's _compute_score for the original
// GitHub+Jira-signal formula this adapts), kept separate from Mongo
// plumbing — see tests/release-gate.test.ts.
//
// aidlc_azure's original pulls "open critical bugs" and "unresolved
// security findings" from GitHub/Jira. This app doesn't have those
// integrations wired to real data yet (see src/lib/integrations/functions.ts),
// so the signals here are Parikshan's own real ones instead: scenario
// coverage, latest run pass rate, un-accepted critical/high scenarios, and
// flaky-test count — same shape of question ("is this project ready to
// ship"), different, honestly-available inputs.
export interface ReleaseGateInputs {
  coveragePct: number;
  /** null when the project has no recorded runs yet. */
  passRatePct: number | null;
  openCriticalCount: number;
  flakyTestCount: number;
}

export type GateVerdict = "go" | "go_with_caution" | "no_go";

export interface ReleaseGateReport {
  score: number;
  verdict: GateVerdict;
  blockingReasons: string[];
}

export function evaluateReleaseGate(inputs: ReleaseGateInputs): ReleaseGateReport {
  const passRate = inputs.passRatePct ?? 0;
  const rawScore =
    inputs.coveragePct * 0.3 +
    passRate * 0.3 +
    Math.max(0, 1 - inputs.openCriticalCount / 5) * 100 * 0.25 +
    Math.max(0, 1 - inputs.flakyTestCount / 5) * 100 * 0.15;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const blockingReasons: string[] = [];
  if (inputs.passRatePct === null) {
    blockingReasons.push("No test runs recorded yet for this project.");
  } else if (inputs.passRatePct < 80) {
    blockingReasons.push(`Last run pass rate is ${inputs.passRatePct}% (below 80%).`);
  }
  if (inputs.openCriticalCount > 0) {
    blockingReasons.push(
      `${inputs.openCriticalCount} critical/high-priority scenario(s) not yet accepted.`,
    );
  }
  if (inputs.coveragePct < 50) {
    blockingReasons.push(`Scenario coverage is ${inputs.coveragePct}% (below 50%).`);
  }
  if (inputs.flakyTestCount > 0) {
    blockingReasons.push(`${inputs.flakyTestCount} flaky test(s) detected in recent runs.`);
  }

  const verdict: GateVerdict =
    score >= 80 && blockingReasons.length === 0 ? "go" : score >= 60 ? "go_with_caution" : "no_go";

  return { score, verdict, blockingReasons };
}
