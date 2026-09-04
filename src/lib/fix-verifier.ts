import "server-only";

/**
 * Checks whether a fix fixed the bug or just stopped the test complaining.
 *
 * Re-running the spec is not enough on its own: the cheapest way to make a
 * failing test pass is to change what it asserts, and that leaves the defect in
 * place while every dashboard turns green. So the spec itself is diffed against
 * what it was before the fix, and a change to what it checks is treated as a
 * finding rather than as progress.
 *
 * The bias is deliberate. A fix that only touched the implementation and made
 * the test pass is accepted; anything that moved an assertion is rejected for a
 * human to look at, even if it is legitimate. Test edits are sometimes correct,
 * but a harness that waves them through cannot be the thing that makes an
 * automated fixer safe.
 */

export type Assertion = {
  /** The whole expect(...) call, normalised so formatting alone is not a change. */
  text: string;
  matcher: string;
  /** Literal the matcher was given, where there is one. */
  expected: string | null;
};

export type SpecDiff = {
  removed: Assertion[];
  added: Assertion[];
  changed: Array<{ before: Assertion; after: Assertion }>;
  skipAdded: boolean;
  timeoutRaised: { before: number; after: number } | null;
  unchanged: boolean;
};

export type RunOutcome = { total: number; passed: number; failed: number };

export type VerificationVerdict = {
  outcome: "accepted" | "rejected";
  reasons: string[];
  diff: SpecDiff;
  targetSpecPasses: boolean;
  suiteRegressed: boolean;
};

/** Collapses whitespace so reformatting is not mistaken for a change. */
function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Pulls the assertions out of a spec.
 *
 * Deliberately textual rather than a parse. A real parser would be better, and
 * a fixer that wanted to hide a change could defeat this - but it is not a
 * security boundary, it is a check on a cooperating agent, and it catches every
 * ordinary way an assertion gets weakened.
 */
export function extractAssertions(code: string): Assertion[] {
  const found: Assertion[] = [];
  const re = /(await\s+)?expect(?:\.soft)?\s*\(([\s\S]*?)\)\s*\.((?:not\.)?[a-zA-Z]+)\s*\(([\s\S]*?)\)\s*;/g;

  for (const m of code.matchAll(re)) {
    const matcher = m[3];
    const arg = normalise(m[4]);
    found.push({
      text: normalise(m[0]),
      matcher,
      expected: arg.length > 0 ? arg : null,
    });
  }
  return found;
}

function sameAssertion(a: Assertion, b: Assertion): boolean {
  return a.matcher === b.matcher && a.expected === b.expected;
}

export function diffSpec(before: string, after: string): SpecDiff {
  const a = extractAssertions(before);
  const b = extractAssertions(after);

  const removed: Assertion[] = [];
  const changed: Array<{ before: Assertion; after: Assertion }> = [];
  const matchedAfter = new Set<number>();

  for (const x of a) {
    const exactIndex = b.findIndex((y, i) => !matchedAfter.has(i) && sameAssertion(x, y));
    if (exactIndex >= 0) {
      matchedAfter.add(exactIndex);
      continue;
    }
    // Same matcher, different expectation, is the important case: the check
    // survived but what it demands moved.
    const shiftedIndex = b.findIndex((y, i) => !matchedAfter.has(i) && y.matcher === x.matcher);
    if (shiftedIndex >= 0) {
      matchedAfter.add(shiftedIndex);
      changed.push({ before: x, after: b[shiftedIndex] });
    } else {
      removed.push(x);
    }
  }

  const added = b.filter((_, i) => !matchedAfter.has(i));

  const skipAdded =
    /test\s*\.\s*(skip|fixme|fail)\s*\(/.test(after) && !/test\s*\.\s*(skip|fixme|fail)\s*\(/.test(before);

  const timeoutOf = (code: string) => {
    const nums = [...code.matchAll(/timeout\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
    return nums.length ? Math.max(...nums) : 0;
  };
  const tBefore = timeoutOf(before);
  const tAfter = timeoutOf(after);

  return {
    removed,
    added,
    changed,
    skipAdded,
    timeoutRaised: tAfter > tBefore ? { before: tBefore, after: tAfter } : null,
    unchanged:
      removed.length === 0 &&
      added.length === 0 &&
      changed.length === 0 &&
      !skipAdded &&
      tAfter <= tBefore,
  };
}

export function verifyFix(input: {
  specBefore: string;
  specAfter: string;
  targetSpecPasses: boolean;
  suiteBefore: RunOutcome;
  suiteAfter: RunOutcome;
}): VerificationVerdict {
  const diff = diffSpec(input.specBefore, input.specAfter);
  const reasons: string[] = [];

  // A spec that was already failing is expected to stop failing; the rest of
  // the suite is expected not to start.
  const newlyFailing = input.suiteAfter.failed - (input.suiteBefore.failed - 1);
  const suiteRegressed = newlyFailing > 0;

  if (diff.skipAdded) {
    reasons.push(
      "The spec was skipped rather than fixed. A skipped test reports nothing, so the defect it was covering is now invisible.",
    );
  }

  for (const a of diff.removed) {
    reasons.push(
      `An assertion was removed: ${a.text.slice(0, 140)}. Deleting a check makes a test pass without changing what the application does.`,
    );
  }

  for (const c of diff.changed) {
    reasons.push(
      `An assertion's expectation was changed from ${c.before.expected ?? "(none)"} to ${c.after.expected ?? "(none)"} on ${c.before.matcher}. The test now agrees with the behaviour it was written to catch, which is the test moving to meet the bug rather than the bug being fixed.`,
    );
  }

  if (diff.timeoutRaised) {
    reasons.push(
      `A timeout was raised from ${diff.timeoutRaised.before} to ${diff.timeoutRaised.after}. Waiting longer can hide a real slowdown instead of resolving it.`,
    );
  }

  if (!input.targetSpecPasses) {
    reasons.push("The spec this fix was meant to address still fails, so the change did not address it.");
  }

  if (suiteRegressed) {
    reasons.push(
      `The rest of the suite got worse: ${input.suiteBefore.failed} failing before, ${input.suiteAfter.failed} after. A fix that breaks something else is not a fix.`,
    );
  }

  const outcome =
    reasons.length === 0 && diff.unchanged && input.targetSpecPasses && !suiteRegressed
      ? "accepted"
      : "rejected";

  if (outcome === "accepted") {
    reasons.push(
      "The spec is byte-for-byte unchanged in what it asserts, it now passes, and nothing else in the suite started failing. The behaviour changed, not the expectation.",
    );
  }

  return { outcome, reasons, diff, targetSpecPasses: input.targetSpecPasses, suiteRegressed };
}
