// Verifies the pure Release Gate scoring logic
// (src/lib/release-gate/evaluate.ts) — no MongoDB needed.
//
//   node --test tests/release-gate.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { evaluateReleaseGate } from "../src/lib/release-gate/evaluate.ts";

describe("evaluateReleaseGate", () => {
  test("a healthy project scores high and gets a clean 'go'", () => {
    const report = evaluateReleaseGate({
      coveragePct: 100,
      passRatePct: 100,
      openCriticalCount: 0,
      flakyTestCount: 0,
    });
    assert.equal(report.verdict, "go");
    assert.equal(report.score, 100);
    assert.deepEqual(report.blockingReasons, []);
  });

  test("a project with no runs yet can never be a clean 'go'", () => {
    const report = evaluateReleaseGate({
      coveragePct: 100,
      passRatePct: null,
      openCriticalCount: 0,
      flakyTestCount: 0,
    });
    assert.notEqual(report.verdict, "go");
    assert.match(report.blockingReasons[0]!, /No test runs recorded/);
  });

  test("open critical scenarios and low coverage both surface as blocking reasons", () => {
    const report = evaluateReleaseGate({
      coveragePct: 20,
      passRatePct: 50,
      openCriticalCount: 2,
      flakyTestCount: 0,
    });
    assert.equal(report.verdict, "no_go");
    assert.ok(report.blockingReasons.some((r) => /critical\/high-priority/.test(r)));
    assert.ok(report.blockingReasons.some((r) => /coverage is 20%/.test(r)));
  });

  test("a middling score lands on go_with_caution", () => {
    const report = evaluateReleaseGate({
      coveragePct: 70,
      passRatePct: 70,
      openCriticalCount: 1,
      flakyTestCount: 1,
    });
    assert.equal(report.verdict, "go_with_caution");
  });

  test("score is clamped to [0, 100]", () => {
    const report = evaluateReleaseGate({
      coveragePct: 0,
      passRatePct: 0,
      openCriticalCount: 999,
      flakyTestCount: 999,
    });
    assert.ok(report.score >= 0 && report.score <= 100);
    assert.equal(report.verdict, "no_go");
  });
});
