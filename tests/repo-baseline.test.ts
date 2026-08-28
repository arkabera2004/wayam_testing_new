// Verifies the pure repo-baseline analysis logic
// (src/lib/repo-baseline/analyze.ts) — no GitHub API or MongoDB needed.
//
//   node --test tests/repo-baseline.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { analyzeRepoBaseline } from "../src/lib/repo-baseline/analyze.ts";

describe("analyzeRepoBaseline", () => {
  test("breaks down known languages by extension, ignoring unknown ones", () => {
    const report = analyzeRepoBaseline(
      ["src/index.ts", "src/app.tsx", "README.md", "package-lock.json"],
      null,
    );
    assert.equal(report.totalFiles, 4);
    assert.deepEqual(
      report.languages.map((l) => l.extension),
      ["ts", "tsx"],
    );
    assert.equal(report.languages[0]!.pct, 50);
  });

  test("detects test files by path and by filename suffix", () => {
    const report = analyzeRepoBaseline(
      ["tests/e2e/checkout.spec.ts", "src/checkout.test.ts", "src/app.ts"],
      null,
    );
    assert.equal(report.testFileCount, 2);
  });

  test("detects a GitHub Actions CI config", () => {
    const withCi = analyzeRepoBaseline([".github/workflows/ci.yml", "src/app.ts"], null);
    const withoutCi = analyzeRepoBaseline(["src/app.ts"], null);
    assert.equal(withCi.hasCiConfig, true);
    assert.equal(withoutCi.hasCiConfig, false);
  });

  test("reports README presence and length", () => {
    const withReadme = analyzeRepoBaseline(["src/app.ts"], "Hello world");
    const withoutReadme = analyzeRepoBaseline(["src/app.ts"], null);
    assert.equal(withReadme.hasReadme, true);
    assert.equal(withReadme.readmeLength, 11);
    assert.equal(withoutReadme.hasReadme, false);
    assert.equal(withoutReadme.readmeLength, 0);
  });

  test("handles an empty file list", () => {
    const report = analyzeRepoBaseline([], null);
    assert.equal(report.totalFiles, 0);
    assert.deepEqual(report.languages, []);
  });
});
