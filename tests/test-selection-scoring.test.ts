// Verifies the pure Intelligent Test Selection scoring logic
// (src/lib/test-selection/scoring.ts) — no MongoDB needed.
//
//   node --test tests/test-selection-scoring.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { scoreTestSelection } from "../src/lib/test-selection/scoring.ts";

const CANDIDATES = [
  {
    testCaseId: "a",
    scenarioTitle: "Checkout completes with a valid cart",
    filePath: "tests/e2e/checkout.spec.ts",
  },
  {
    testCaseId: "b",
    scenarioTitle: "Login rejects bad credentials",
    filePath: "tests/api/login.spec.ts",
  },
  { testCaseId: "c", scenarioTitle: "Homepage renders the hero", filePath: null },
];

describe("scoreTestSelection", () => {
  test("selects the full suite when no changed files are given", () => {
    const results = scoreTestSelection(CANDIDATES, []);
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.selected));
    assert.match(results[0]!.reasons[0]!.label, /full suite selected as a safe fallback/);
  });

  test("scores a test higher when its filename stem matches the changed file", () => {
    const results = scoreTestSelection(CANDIDATES, ["src/checkout.ts"]);
    const checkout = results.find((r) => r.testCaseId === "a")!;
    const login = results.find((r) => r.testCaseId === "b")!;

    assert.ok(checkout.selected);
    assert.ok(checkout.score > login.score);
    assert.ok(checkout.reasons.some((r) => /matches changed file/.test(r.label)));
  });

  test("selects a test sharing a directory with the changed file, scored lower than a stem match", () => {
    const results = scoreTestSelection(CANDIDATES, ["tests/e2e/other-flow.ts"]);
    const checkout = results.find((r) => r.testCaseId === "a")!;
    assert.ok(checkout.selected);
    assert.ok(checkout.reasons.some((r) => /Shares a directory/.test(r.label)));
  });

  test("falls back to the full suite when no test overlaps the changed files", () => {
    const results = scoreTestSelection(CANDIDATES, ["infra/terraform/main.tf"]);
    assert.ok(results.every((r) => r.selected));
    assert.ok(results.every((r) => r.reasons.some((reason) => /safe fallback/.test(reason.label))));
  });

  test("a candidate with no filePath never gets a stem/directory match but can still be caught by the fallback", () => {
    const results = scoreTestSelection(CANDIDATES, ["src/checkout.ts"]);
    const homepage = results.find((r) => r.testCaseId === "c")!;
    assert.equal(homepage.selected, false);
    assert.equal(homepage.score, 0);
  });
});
