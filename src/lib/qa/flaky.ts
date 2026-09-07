import "server-only";

import { eq, desc, inArray } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { runSuite } from "@/lib/test-runner";

/**
 * Deciding whether a test is unstable, by running it again.
 *
 * The classifier already reads flakiness out of history, which answers "has
 * this been inconsistent before". It cannot answer "is this inconsistent now",
 * because that requires provoking the behaviour rather than remembering it.
 * A test that fails once has told you almost nothing; the same test run five
 * times has told you what kind of failure it is.
 *
 * The whole suite is re-run rather than the single spec, because a test that
 * only fails when its neighbours run is exactly the kind of instability worth
 * catching, and running it alone would hide that.
 */

export type Stability = "STABLE_PASS" | "STABLE_FAIL" | "FLAKY" | "ENVIRONMENTAL" | "UNKNOWN";

export type StabilityReport = {
  testCaseId: string;
  title: string;
  runs: number;
  passed: number;
  failed: number;
  stability: Stability;
  confidence: number;
  durations: number[];
  /** Max/min duration. A spec whose timing swings is a spec near a timeout. */
  timingRatio: number | null;
  distinctErrors: string[];
  reasoning: string;
};

const DEFAULT_RUNS = 5;

export async function assessStability(
  projectId: string,
  opts?: { runs?: number; caseIds?: string[] },
): Promise<StabilityReport[]> {
  const db = getDb();
  const runs = Math.max(3, Math.min(opts?.runs ?? DEFAULT_RUNS, 10));

  const runIds: string[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      const outcome = await runSuite(projectId, { caseIds: opts?.caseIds });
      runIds.push(outcome.runId);
    } catch {
      // A run that could not start says something about the environment, not
      // about any spec in it. Recorded by its absence rather than as a failure.
    }
  }
  if (runIds.length === 0) return [];

  const rows = await db
    .select({
      testCaseId: schema.testRunResults.testCaseId,
      status: schema.testRunResults.status,
      durationMs: schema.testRunResults.durationMs,
      errorMessage: schema.testRunResults.errorMessage,
      classification: schema.testRunResults.classification,
      title: schema.testCases.title,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testCases, eq(schema.testCases.id, schema.testRunResults.testCaseId))
    .where(inArray(schema.testRunResults.runId, runIds));

  const byCase = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.testCaseId) continue;
    byCase.set(r.testCaseId, [...(byCase.get(r.testCaseId) ?? []), r]);
  }

  const reports: StabilityReport[] = [];

  for (const [testCaseId, results] of byCase) {
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.length - passed;
    const durations = results.map((r) => r.durationMs ?? 0).filter((d) => d > 0);
    const lo = durations.length ? Math.min(...durations) : 0;
    const hi = durations.length ? Math.max(...durations) : 0;
    const timingRatio = lo > 0 ? Number((hi / lo).toFixed(2)) : null;

    // The first line of a message identifies the failure; the rest is a stack
    // that differs run to run and would make every failure look distinct.
    const distinctErrors = [
      ...new Set(results.filter((r) => r.errorMessage).map((r) => (r.errorMessage as string).split("\n")[0].slice(0, 120))),
    ];

    const anyEnvironment = results.some((r) => r.classification === "environment");

    let stability: Stability;
    let confidence: number;
    let reasoning: string;

    if (anyEnvironment && failed > 0 && passed > 0) {
      stability = "ENVIRONMENTAL";
      confidence = 70;
      reasoning = `Mixed outcomes across ${results.length} runs, and at least one failure was classified as an environment outage. The target being unreachable says nothing about this spec.`;
    } else if (passed === results.length) {
      stability = "STABLE_PASS";
      // Timing that swings widely is a pass that may not survive a slower day.
      confidence = timingRatio !== null && timingRatio > 3 ? 70 : 95;
      reasoning =
        timingRatio !== null && timingRatio > 3
          ? `Passed ${passed} of ${results.length}, but its duration varied ${timingRatio}x (${lo}-${hi}ms). Consistent now, close to timing-sensitive.`
          : `Passed ${passed} of ${results.length} with duration within ${timingRatio ?? 1}x. Deterministic across this sample.`;
    } else if (failed === results.length) {
      stability = "STABLE_FAIL";
      confidence = 95;
      reasoning = `Failed all ${results.length} runs${distinctErrors.length === 1 ? " with the same error each time" : ` with ${distinctErrors.length} different errors`}. Repeatable, so not flakiness.`;
    } else {
      stability = "FLAKY";
      // Closer to an even split is stronger evidence of genuine instability
      // than a single odd result out of five.
      const ratio = Math.min(passed, failed) / results.length;
      confidence = Math.round(60 + ratio * 70);
      reasoning = `Passed ${passed} and failed ${failed} across ${results.length} runs of the same unchanged spec against the same build. Non-deterministic.`;
    }

    reports.push({
      testCaseId,
      title: results[0].title ?? "(untitled)",
      runs: results.length,
      passed,
      failed,
      stability,
      confidence,
      durations,
      timingRatio,
      distinctErrors,
      reasoning,
    });
  }

  return reports.sort((a, b) => {
    const rank: Stability[] = ["FLAKY", "STABLE_FAIL", "ENVIRONMENTAL", "UNKNOWN", "STABLE_PASS"];
    return rank.indexOf(a.stability) - rank.indexOf(b.stability);
  });
}

/** Most recent run of a project, for reports that need a starting point. */
export async function latestRunId(projectId: string): Promise<string | null> {
  const db = getDb();
  const suites = await db
    .select({ id: schema.testSuites.id })
    .from(schema.testSuites)
    .where(eq(schema.testSuites.projectId, projectId));
  if (!suites.length) return null;

  const [run] = await db
    .select({ id: schema.testRuns.id })
    .from(schema.testRuns)
    .where(inArray(schema.testRuns.suiteId, suites.map((s) => s.id)))
    .orderBy(desc(schema.testRuns.startedAt))
    .limit(1);
  return run?.id ?? null;
}
