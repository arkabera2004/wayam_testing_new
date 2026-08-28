// Pure scoring logic for Intelligent Test Selection, kept separate from
// scoring's Mongo/server-function plumbing so it can be unit tested without
// a database — see tests/test-selection-scoring.test.ts.
//
// Heuristic (no ML/LLM involved, same spirit as the flaky-test detector in
// src/lib/dashboard/functions.ts): a test case is relevant to a changed
// file if they share a directory segment or a filename stem. This is a
// real, deterministic signal — not a simulation — though it's coarser than
// aidlc_azure's original AST-aware impact analysis (that's a further
// INTEGRATION POINT, not reimplemented here).
import { filenameStem, pathSegments } from "../shared/file-overlap.ts";

export interface SelectionInput {
  testCaseId: string;
  scenarioTitle: string;
  filePath: string | null;
}

export interface SelectionReason {
  label: string;
  matched: boolean;
}

export interface SelectionResult {
  testCaseId: string;
  score: number;
  selected: boolean;
  reasons: SelectionReason[];
}

/** Splits a title/description into lowercase word tokens for a loose
 * "does the changed file's name show up in this test's own name" check. */
function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
}

/**
 * Scores every test case against the given changed files. When no changed
 * files are provided, every test is selected (full suite) — matches the
 * "no diff available" safe-fallback behavior of the original page.
 */
export function scoreTestSelection(
  candidates: SelectionInput[],
  changedFiles: string[],
): SelectionResult[] {
  const cleanedChanges = changedFiles.map((f) => f.trim()).filter(Boolean);

  if (cleanedChanges.length === 0) {
    return candidates.map((c) => ({
      testCaseId: c.testCaseId,
      score: 0,
      selected: true,
      reasons: [
        {
          label: "No changed files provided — full suite selected as a safe fallback",
          matched: true,
        },
      ],
    }));
  }

  const changeDirs = cleanedChanges.map((f) => new Set(pathSegments(f).slice(0, -1)));
  const changeStems = cleanedChanges.map((f) => filenameStem(f));

  const results = candidates.map((c): SelectionResult => {
    let score = 0;
    const reasons: SelectionReason[] = [];
    const testDirs = c.filePath
      ? new Set(pathSegments(c.filePath).slice(0, -1))
      : new Set<string>();
    const testStem = c.filePath ? filenameStem(c.filePath) : "";
    const tokens = titleTokens(c.scenarioTitle);

    for (let i = 0; i < cleanedChanges.length; i++) {
      const change = cleanedChanges[i]!;
      const dirOverlap = [...changeDirs[i]!].some((seg) => testDirs.has(seg));
      const stemOverlap = testStem !== "" && testStem === changeStems[i];
      const nameMentioned = changeStems[i]!.length > 2 && tokens.has(changeStems[i]!);

      if (stemOverlap) {
        score += 5;
        reasons.push({ label: `Test file matches changed file "${change}"`, matched: true });
      }
      if (dirOverlap && !stemOverlap) {
        score += 2;
        reasons.push({ label: `Shares a directory with "${change}"`, matched: true });
      }
      if (nameMentioned && !stemOverlap) {
        score += 1;
        reasons.push({ label: `Scenario title mentions "${changeStems[i]}"`, matched: true });
      }
    }

    if (score === 0) {
      reasons.push({ label: "No overlap with changed files", matched: false });
    }

    return { testCaseId: c.testCaseId, score, selected: score > 0, reasons };
  });

  // Safe fallback: if the diff touched files that map to none of the
  // project's tests, don't silently skip everything — select the full
  // suite instead, same as the "no diff available" branch above.
  if (results.every((r) => !r.selected)) {
    return results.map((r) => ({
      ...r,
      selected: true,
      reasons: [
        {
          label: "No file overlap detected — full suite selected as a safe fallback",
          matched: true,
        },
        ...r.reasons.filter((reason) => reason.matched),
      ],
    }));
  }

  return results;
}
