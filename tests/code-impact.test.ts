// Verifies the pure Code Impact analysis logic
// (src/lib/code-impact/analyze.ts) — no MongoDB needed.
//
//   node --test tests/code-impact.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { analyzeCodeImpact } from "../src/lib/code-impact/analyze.ts";

const CANDIDATES = [
  {
    testCaseId: "a",
    scenarioTitle: "Checkout completes",
    scenarioType: "E2E",
    priority: "critical",
    filePath: "tests/e2e/checkout.spec.ts",
  },
  {
    testCaseId: "b",
    scenarioTitle: "Login rejects bad credentials",
    scenarioType: "API",
    priority: "medium",
    filePath: "tests/api/login.spec.ts",
  },
];

describe("analyzeCodeImpact", () => {
  test("flags a changed file with no matching test as unknown risk", () => {
    const summary = analyzeCodeImpact(["infra/terraform/main.tf"], CANDIDATES);
    assert.equal(summary.files[0]!.riskTier, "unknown");
    assert.equal(summary.untestedFileCount, 1);
    assert.equal(summary.totalAffectedTests, 0);
  });

  test("rates a file covered by a critical-priority test as high risk", () => {
    const summary = analyzeCodeImpact(["src/checkout.ts"], CANDIDATES);
    assert.equal(summary.files[0]!.riskTier, "high");
    assert.equal(summary.files[0]!.affectedTests.length, 1);
    assert.equal(summary.files[0]!.affectedTests[0]!.testCaseId, "a");
  });

  test("rates a file covered only by medium-priority tests as medium risk", () => {
    const summary = analyzeCodeImpact(["src/login.ts"], CANDIDATES);
    assert.equal(summary.files[0]!.riskTier, "medium");
  });

  test("overall risk tier is the worst of any single file", () => {
    const summary = analyzeCodeImpact(["src/checkout.ts", "src/login.ts"], CANDIDATES);
    assert.equal(summary.overallRiskTier, "high");
    assert.equal(summary.totalAffectedTests, 2);
  });

  test("counts a shared test case toward totalAffectedTests only once", () => {
    const summary = analyzeCodeImpact(
      ["tests/e2e/checkout.spec.ts", "tests/e2e/other.ts"],
      [{ ...CANDIDATES[0]!, filePath: "tests/e2e/checkout.spec.ts" }],
    );
    // "tests/e2e/other.ts" shares the tests/e2e directory, so both files
    // point at the same single test case.
    assert.equal(summary.totalAffectedTests, 1);
  });
});
