import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Proposes a change for a classified real bug. Proposes only - nothing here
 * writes to the working tree, and nothing here merges anything.
 *
 * Two safety properties are structural rather than checked afterwards:
 *
 * A spec can never be edited. The fixer refuses any candidate path that looks
 * like a test, so the failure mode the Phase 4 harness exists to catch - a fix
 * that changes the assertion instead of the behaviour - cannot be produced in
 * the first place. The harness stays as the second line, not the only one.
 *
 * It refuses far more than it accepts. It handles the one case it can actually
 * reason about: an assertion that names the value it wanted and the value it
 * got, where that received value appears as a literal in the source. Anything
 * else returns a refusal with the reason. A fixer that guesses at bugs it does
 * not understand would need a reviewer to catch every mistake, and reviewers
 * stop reading when most of what they see is noise.
 */

export type FixProposal = {
  file: string;
  line: number;
  before: string;
  after: string;
  expected: string;
  received: string;
  rationale: string;
  caveat: string;
};

export type FixRefusal = { refused: true; reason: string };

/** Anything that looks like a test is off limits, whatever else is true. */
function isTestPath(file: string): boolean {
  return /(^|\/)(tests?|__tests__|e2e|spec)(\/|$)|\.(spec|test)\.[cm]?[jt]sx?$/i.test(file);
}

/** Pulls the two values a failed value-assertion reports. */
export function parseValueMismatch(error: string): { expected: string; received: string } | null {
  // Playwright labels these differently per matcher: toContainText writes
  // "Expected substring", toHaveText writes a bare "Expected". Both forms.
  const expected = error.match(/Expected(?: substring| string| value| pattern)?:\s*"([^"]*)"/)?.[1];
  const received = error.match(/Received(?: string| value)?:\s*"([^"]*)"/)?.[1];
  if (!expected || !received) return null;
  if (expected === received) return null;
  return { expected, received };
}

export async function proposeFix(input: {
  classification: string | null;
  errorMessage: string | null;
  /** Absolute root the fixer may read and propose within. */
  sourceRoot: string;
  /** Candidate files, relative to sourceRoot. */
  candidateFiles: string[];
}): Promise<FixProposal | FixRefusal> {
  if (input.classification !== "real-bug") {
    return {
      refused: true,
      reason: `Only failures classified as a real bug are eligible, and this one is ${input.classification ?? "unclassified"}. A drift, a flake or an outage is not something to change the application for.`,
    };
  }

  const parsed = parseValueMismatch(input.errorMessage ?? "");
  if (!parsed) {
    return {
      refused: true,
      reason:
        "This failure does not state both the value it expected and the value it received, so there is nothing here to derive a change from. Only assertions that name both are handled.",
    };
  }

  const { expected, received } = parsed;

  const searchable = input.candidateFiles.filter((f) => !isTestPath(f));
  const skippedTests = input.candidateFiles.length - searchable.length;

  for (const rel of searchable) {
    let content: string;
    try {
      content = await readFile(path.join(input.sourceRoot, rel), "utf8");
    } catch {
      continue;
    }
    if (!content.includes(received)) continue;

    const lines = content.split("\n");
    const index = lines.findIndex((l) => l.includes(received));
    if (index < 0) continue;

    // The assertion asks for a substring, so the smallest honest change is to
    // put that substring back into the message the application already has.
    // What the wording should actually be is a judgement, not a derivation.
    const suggested = received.includes(expected) ? received : `${received.replace(/\.$/, "")} (${expected})`;
    const restored = expected.length > 12 ? expected : suggested;

    return {
      file: rel,
      line: index + 1,
      before: lines[index],
      after: lines[index].replace(received, restored),
      expected,
      received,
      rationale: `The spec asserts the value contains "${expected}". The application produces "${received}", which does not. That literal is at ${rel}:${index + 1}, so the difference between what the test demands and what the code does is here${skippedTests > 0 ? `. ${skippedTests} test ${skippedTests === 1 ? "file was" : "files were"} excluded from the search, since changing a test is not a fix` : ""}.`,
      caveat: `The replacement satisfies the assertion; it is not necessarily the right wording. A human should decide what this message should actually say - the fixer knows what the test demands, not what the product means.`,
    };
  }

  return {
    refused: true,
    reason: `The value the application produced ("${received.slice(0, 60)}") was not found as a literal in any non-test source file, so there is nothing to point at. It may be assembled at run time, which is beyond what this fixer reads.`,
  };
}
