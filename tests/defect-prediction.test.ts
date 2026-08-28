// Verifies the pure defect-risk scoring logic
// (src/lib/defect-prediction/risk.ts) — no GitHub API or MongoDB needed.
//
//   node --test tests/defect-prediction.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { computeDefectRisk, isBugFixMessage } from "../src/lib/defect-prediction/risk.ts";

describe("isBugFixMessage", () => {
  test("recognizes common bug-fix keywords", () => {
    assert.equal(isBugFixMessage("Fix null pointer in checkout"), true);
    assert.equal(isBugFixMessage("Revert previous change"), true);
    assert.equal(isBugFixMessage("Add new pricing page"), false);
  });
});

describe("computeDefectRisk", () => {
  test("ranks a frequently bug-fixed file higher than a rarely touched one", () => {
    const commits = [
      {
        message: "Fix crash in checkout",
        author: "a",
        files: [{ filename: "checkout.ts", additions: 5, deletions: 2 }],
      },
      {
        message: "Fix another checkout bug",
        author: "b",
        files: [{ filename: "checkout.ts", additions: 3, deletions: 1 }],
      },
      {
        message: "Add footer link",
        author: "a",
        files: [{ filename: "footer.ts", additions: 10, deletions: 0 }],
      },
    ];
    const risks = computeDefectRisk(commits);
    const checkout = risks.find((r) => r.filename === "checkout.ts")!;
    const footer = risks.find((r) => r.filename === "footer.ts")!;
    assert.ok(checkout.riskScore > footer.riskScore);
    assert.equal(checkout.bugFixCount, 2);
  });

  test("counts distinct authors per file", () => {
    const commits = [
      {
        message: "Fix a",
        author: "alice",
        files: [{ filename: "x.ts", additions: 1, deletions: 0 }],
      },
      {
        message: "Fix b",
        author: "bob",
        files: [{ filename: "x.ts", additions: 1, deletions: 0 }],
      },
      {
        message: "Fix c",
        author: "alice",
        files: [{ filename: "x.ts", additions: 1, deletions: 0 }],
      },
    ];
    const [risk] = computeDefectRisk(commits);
    assert.equal(risk!.authorCount, 2);
    assert.equal(risk!.changeCount, 3);
  });

  test("caps results at the given limit", () => {
    const commits = Array.from({ length: 30 }, (_, i) => ({
      message: "Fix bug",
      author: "a",
      files: [{ filename: `file-${i}.ts`, additions: 1, deletions: 0 }],
    }));
    assert.equal(computeDefectRisk(commits, 5).length, 5);
  });

  test("returns an empty list for no commits", () => {
    assert.deepEqual(computeDefectRisk([]), []);
  });
});
