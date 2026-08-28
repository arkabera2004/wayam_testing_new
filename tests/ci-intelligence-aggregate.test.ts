// Verifies the pure CI Intelligence aggregation logic
// (src/lib/ci-intelligence/aggregate.ts) — no MongoDB needed.
//
//   node --test tests/ci-intelligence-aggregate.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { computeCiIntelligence } from "../src/lib/ci-intelligence/aggregate.ts";

describe("computeCiIntelligence", () => {
  test("returns zeroed summary for no runs", () => {
    const summary = computeCiIntelligence([], []);
    assert.equal(summary.totalRuns, 0);
    assert.equal(summary.overallPassRate, 0);
    assert.equal(summary.avgDurationMs, 0);
    assert.deepEqual(summary.byTrigger, []);
    assert.deepEqual(summary.slowestTests, []);
  });

  test("computes overall pass rate and average duration", () => {
    const runs = [
      { trigger: "manual", status: "passed", startedAt: new Date(0), finishedAt: new Date(1000) },
      { trigger: "manual", status: "failed", startedAt: new Date(0), finishedAt: new Date(3000) },
    ];
    const summary = computeCiIntelligence(runs, []);
    assert.equal(summary.totalRuns, 2);
    assert.equal(summary.overallPassRate, 50);
    assert.equal(summary.avgDurationMs, 2000);
  });

  test("breaks down pass rate and duration per trigger", () => {
    const runs = [
      { trigger: "manual", status: "passed", startedAt: new Date(0), finishedAt: new Date(1000) },
      { trigger: "on_pr", status: "passed", startedAt: new Date(0), finishedAt: new Date(2000) },
      { trigger: "on_pr", status: "failed", startedAt: new Date(0), finishedAt: new Date(4000) },
    ];
    const summary = computeCiIntelligence(runs, []);
    const onPr = summary.byTrigger.find((t) => t.trigger === "on_pr")!;
    const manual = summary.byTrigger.find((t) => t.trigger === "manual")!;
    assert.equal(onPr.totalRuns, 2);
    assert.equal(onPr.passRate, 50);
    assert.equal(onPr.avgDurationMs, 3000);
    assert.equal(manual.passRate, 100);
  });

  test("ranks the slowest test cases by average duration, capped at 5", () => {
    const results = Array.from({ length: 7 }, (_, i) => ({
      testCaseId: `case-${i}`,
      scenarioTitle: `Scenario ${i}`,
      status: "passed",
      durationMs: (i + 1) * 1000,
    }));
    const summary = computeCiIntelligence([], results);
    assert.equal(summary.slowestTests.length, 5);
    assert.equal(summary.slowestTests[0]!.scenarioTitle, "Scenario 6");
    assert.equal(summary.slowestTests[0]!.avgDurationMs, 7000);
  });

  test("averages duration across multiple runs of the same test case", () => {
    const results = [
      { testCaseId: "a", scenarioTitle: "Checkout", status: "passed", durationMs: 1000 },
      { testCaseId: "a", scenarioTitle: "Checkout", status: "failed", durationMs: 3000 },
    ];
    const summary = computeCiIntelligence([], results);
    assert.equal(summary.slowestTests[0]!.avgDurationMs, 2000);
    assert.equal(summary.slowestTests[0]!.runs, 2);
  });
});
