// Verifies the pure PRD Analysis logic (src/lib/prd-analysis/heuristic.ts)
// — no MongoDB or Gemini needed.
//
//   node --test tests/prd-analysis.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classifyRequirements,
  draftTestCases,
  splitRequirements,
} from "../src/lib/prd-analysis/heuristic.ts";

describe("splitRequirements", () => {
  test("prefers numbered lines when present", () => {
    const doc =
      "1. Users must verify their email.\n2. Passwords must be at least 8 characters.\nSome trailing prose.";
    const reqs = splitRequirements(doc);
    assert.deepEqual(reqs, [
      "Users must verify their email.",
      "Passwords must be at least 8 characters.",
    ]);
  });

  test("prefers bulleted lines when present", () => {
    const doc =
      "- The API must return 404 for unknown ids.\n- The API must return 400 for malformed input.";
    assert.equal(splitRequirements(doc).length, 2);
  });

  test("falls back to sentence splitting with no list structure", () => {
    const doc = "The system must log every login attempt. Failed attempts must be rate limited.";
    assert.equal(splitRequirements(doc).length, 2);
  });
});

describe("classifyRequirements", () => {
  test("classifies a security requirement", () => {
    const [req] = classifyRequirements(["Passwords must be stored encrypted at rest."]);
    assert.equal(req!.category, "security");
  });

  test("classifies a non-functional requirement", () => {
    const [req] = classifyRequirements(["The checkout API must have a response time under 200ms."]);
    assert.equal(req!.category, "non-functional");
  });

  test("classifies a plain functional requirement", () => {
    const [req] = classifyRequirements(["Users can add an item to their cart."]);
    assert.equal(req!.category, "functional");
  });

  test("flags a vague requirement with no number as a gap", () => {
    const [req] = classifyRequirements(["The page must load quickly for most users."]);
    assert.equal(req!.coverage, "gap");
    assert.match(req!.issue!, /Not testable as written/);
  });

  test("flags a vague requirement that does have a number as partial, not a gap", () => {
    const [req] = classifyRequirements(["The page must load reasonably within 3 seconds."]);
    assert.equal(req!.coverage, "partial");
  });

  test("treats a precise, non-vague requirement as covered", () => {
    const [req] = classifyRequirements([
      "The refund endpoint returns 422 after the 30-day window.",
    ]);
    assert.equal(req!.coverage, "covered");
    assert.equal(req!.issue, null);
  });

  test("flags a near-duplicate requirement against an earlier one", () => {
    const reqs = classifyRequirements([
      "The checkout API must respond within 200ms.",
      "The checkout API must respond within two hundred milliseconds.",
    ]);
    assert.equal(reqs[1]!.coverage, "partial");
    assert.match(reqs[1]!.issue!, /Duplicates REQ-1/);
  });
});

describe("draftTestCases", () => {
  test("excludes gap requirements from the draft", () => {
    const reqs = classifyRequirements([
      "The refund endpoint returns 422 after the 30-day window.",
      "The page must feel snappy for most users.",
    ]);
    const cases = draftTestCases(reqs);
    assert.equal(cases.length, 1);
    assert.equal(cases[0]!.requirementId, "REQ-1");
  });

  test("tags a negative-sounding requirement as 'negative'", () => {
    const reqs = classifyRequirements(["The API must reject a payload with a negative quantity."]);
    const [testCase] = draftTestCases(reqs);
    assert.equal(testCase!.tag, "negative");
    assert.equal(testCase!.type, "API");
  });

  test("tags an edge-case requirement and types security ones as critical", () => {
    const reqs = classifyRequirements([
      "Login tokens must expire after the maximum session boundary.",
    ]);
    const [testCase] = draftTestCases(reqs);
    assert.equal(testCase!.tag, "edge-case");
    assert.equal(testCase!.priority, "critical");
  });

  test("defaults an ordinary functional requirement to a happy-path E2E case", () => {
    const reqs = classifyRequirements(["Users can add an item to their cart."]);
    const [testCase] = draftTestCases(reqs);
    assert.equal(testCase!.tag, "happy-path");
    assert.equal(testCase!.type, "E2E");
    assert.equal(testCase!.priority, "medium");
  });
});
