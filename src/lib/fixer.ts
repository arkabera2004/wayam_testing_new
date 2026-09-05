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

/**
 * A URL assertion states its expectation as a pattern more often than a string,
 * and a pattern is not a value: /^\/cart\/\d+$/ describes many paths and names
 * none of them. Only patterns that are a literal wearing regex syntax - escapes
 * and anchors and nothing else - can be turned back into the one path they
 * accept. Anything with a quantifier, a class, a group or an alternation
 * describes a set, and picking a member of that set would be a guess.
 */
function literalFromPattern(pattern: string): string | null {
  const body = pattern.replace(/^\/(.*)\/[gimsuy]*$/, "$1");
  if (body === pattern && !pattern.startsWith("/")) return null;

  const stripped = body.replace(/^\^/, "").replace(/\$$/, "");
  // Any metacharacter that survives means this describes more than one path.
  if (/(?<!\\)[.*+?()\[\]{}|]/.test(stripped)) return null;

  const literal = stripped.replace(/\\(.)/g, "$1");
  return literal.startsWith("/") ? literal : null;
}

/** Pulls the two paths a failed URL assertion reports. */
export function parseUrlMismatch(error: string): { expectedPath: string; receivedPath: string } | null {
  if (!/toHaveURL/.test(error)) return null;

  const receivedRaw = error.match(/Received string:\s*"([^"]*)"/)?.[1];
  if (!receivedRaw) return null;
  let receivedPath: string;
  try {
    receivedPath = new URL(receivedRaw).pathname;
  } catch {
    return null;
  }

  const expectedString = error.match(/Expected string:\s*"([^"]*)"/)?.[1];
  const expectedPattern = error.match(/Expected pattern:\s*(\S+)/)?.[1];

  let expectedPath: string | null = null;
  if (expectedString) {
    try {
      expectedPath = new URL(expectedString).pathname;
    } catch {
      expectedPath = expectedString.startsWith("/") ? expectedString : null;
    }
  } else if (expectedPattern) {
    expectedPath = literalFromPattern(expectedPattern);
  }

  if (!expectedPath || expectedPath === receivedPath) return null;
  return { expectedPath, receivedPath };
}

/**
 * Why a URL assertion could not be reduced to two concrete paths.
 *
 * parseUrlMismatch returns null for several different reasons and the caller
 * cannot tell them apart, so each one is named here rather than collapsed into
 * a single message. A refusal that misdescribes the input is worse than a
 * blunt one: it sends whoever reads it looking for the wrong thing.
 */
function describeUrlRefusal(error: string): string {
  const receivedRaw = error.match(/Received string:\s*"([^"]*)"/)?.[1];
  if (!receivedRaw) {
    return "The URL assertion failed but the error does not report the address the browser ended up at, so there is no wrong destination to trace back to the source.";
  }

  let receivedPath: string;
  try {
    receivedPath = new URL(receivedRaw).pathname;
  } catch {
    return `The URL assertion reported "${receivedRaw.slice(0, 60)}" as the address reached, which is not a URL this can take a path from.`;
  }

  const expectedPattern = error.match(/Expected pattern:\s*(\S+)/)?.[1];
  if (expectedPattern && literalFromPattern(expectedPattern) === null) {
    return `The spec expects the URL to match ${expectedPattern}, which describes a set of paths rather than naming one. The browser went to ${receivedPath}. A pattern is not a value: picking a member of that set to write into the source would be a guess, so only a pattern that is a single literal wearing regex syntax is handled.`;
  }

  const expectedString = error.match(/Expected string:\s*"([^"]*)"/)?.[1];
  if (!expectedPattern && !expectedString) {
    return `The browser went to ${receivedPath}, but the error does not state which address the spec expected, so there is nothing to change it to.`;
  }

  return `The URL assertion reports the same path, ${receivedPath}, as both expected and reached. Whatever made this spec fail is not the destination, so there is no navigation to correct.`;
}

/**
 * Where a page decides to send the browser. These take a literal often enough
 * to be worth searching for, and when they do the wrong destination is a string
 * sitting in the source exactly like a wrong message is.
 */
const NAVIGATION_CALL = /\b(?:router\s*\.\s*(?:push|replace)|redirect|permanentRedirect)\s*\(\s*["'`]([^"'`]+)["'`]/g;

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

  const searchable = input.candidateFiles.filter((f) => !isTestPath(f));
  const skippedTests = input.candidateFiles.length - searchable.length;

  // A URL assertion is the same shape as a message assertion - a wrong literal
  // in the source - but the literal is a destination rather than a sentence,
  // and it is reached through a navigation call rather than rendered.
  const urlMismatch = parseUrlMismatch(input.errorMessage ?? "");
  if (urlMismatch) {
    const navigation = await proposeNavigationFix(input.sourceRoot, searchable, urlMismatch, skippedTests);
    if (navigation) return navigation;
    return {
      refused: true,
      reason: `The page went to ${urlMismatch.receivedPath} instead of ${urlMismatch.expectedPath}, but no navigation call with that destination as a literal was found in non-test source. The destination may be computed, or the redirect may come from configuration rather than code.`,
    };
  }

  // A URL assertion that could not be reduced to two concrete paths has to
  // refuse on its own terms. Falling through to the value-mismatch path below
  // reported that the failure "does not state both the value it expected and
  // the value it received" - which is wrong for a pattern assertion. It states
  // both; it just states the expected one as a set of paths rather than a path.
  if (/toHaveURL/.test(input.errorMessage ?? "")) {
    return { refused: true, reason: describeUrlRefusal(input.errorMessage ?? "") };
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

/**
 * Finds the navigation call that sent the browser to the wrong place.
 *
 * The received path carries the application's base path and the literal in the
 * source does not, so the two are matched on suffix rather than equality. That
 * is looser than comparing whole paths, and it is why the match must be on a
 * navigation call rather than on any occurrence of the string - "/cart" appears
 * in plenty of places that do not decide where the browser goes.
 */
async function proposeNavigationFix(
  sourceRoot: string,
  files: string[],
  mismatch: { expectedPath: string; receivedPath: string },
  skippedTests: number,
): Promise<FixProposal | null> {
  const { expectedPath, receivedPath } = mismatch;

  for (const rel of files) {
    let content: string;
    try {
      content = await readFile(path.join(sourceRoot, rel), "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      NAVIGATION_CALL.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = NAVIGATION_CALL.exec(lines[i])) !== null) {
        const destination = m[1];
        if (!destination.startsWith("/")) continue;
        // The running app prefixes a base path the source literal omits.
        if (!receivedPath.endsWith(destination)) continue;

        // Keep whatever prefix the source uses, replacing only the part that
        // corresponds to the destination that was actually taken.
        const replacement = expectedPath.endsWith(destination)
          ? destination
          : expectedPath.slice(expectedPath.length - destination.length) === destination
            ? destination
            : expectedPath.replace(new RegExp(`^${receivedPath.slice(0, receivedPath.length - destination.length)}`), "");

        const after = lines[i].replace(destination, replacement || expectedPath);
        if (after === lines[i]) continue;

        return {
          file: rel,
          line: i + 1,
          before: lines[i],
          after,
          expected: expectedPath,
          received: receivedPath,
          rationale: `The spec expects the browser to end up at ${expectedPath}; it went to ${receivedPath}. The navigation that sent it there is at ${rel}:${i + 1}, where the destination is the literal "${destination}"${skippedTests > 0 ? `. ${skippedTests} test ${skippedTests === 1 ? "file was" : "files were"} excluded from the search, since changing a test is not a fix` : ""}.`,
          caveat: `This changes where the page sends the browser so the assertion is satisfied. Whether that destination is the right one for this condition is a product decision, not something the failure states.`,
        };
      }
    }
  }

  return null;
}
