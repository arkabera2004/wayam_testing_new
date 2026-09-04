import "server-only";

import type { FAILURE_CLASS } from "@/db/schema";

/**
 * Decides what a failure means, rather than what its error text looks like.
 *
 * The existing categorise() answers "is this a timeout or a locator problem".
 * That is a shape, not a meaning: a timeout can be a flake, a dead environment
 * or a genuine hang, and the error text alone cannot tell them apart. This
 * weighs several signals, including ones no single result carries - what the
 * rest of the run did, and what this same test did in earlier runs.
 *
 * Confidence follows the self-healing pattern: evidence accumulates, the
 * categories are ranked, and a verdict is refused unless the winner is both
 * strong enough and clearly ahead. A near-tie is reported as unclassified,
 * because picking between 60 and 58 would be inventing certainty.
 */

export type FailureClass = (typeof FAILURE_CLASS)[number];

export type Evidence = { signal: string; category: string; weight: number; detail: string };

export type Verdict = {
  classification: FailureClass;
  confidence: number;
  evidence: Evidence[];
};

export type ResultInput = {
  id: string;
  testCaseId: string | null;
  status: string | null;
  errorMessage: string | null;
  durationMs: number | null;
};

export type HistoryEntry = {
  status: string | null;
  at: Date | null;
  /** How that earlier failure was judged, so outages can be set aside. */
  classification?: string | null;
};

export type ClassifyInput = {
  /** Every result in the run, so run-wide patterns are visible. */
  results: ResultInput[];
  /** Earlier results per test case, newest first, excluding this run. */
  history: Map<string, HistoryEntry[]>;
  /** When each case's spec last changed, to tell a flake from a code change. */
  caseUpdatedAt: Map<string, Date | null>;
  /** Whether a replacement locator is findable, when that can be checked. */
  hasHealCandidate?: (result: ResultInput) => boolean;
};

/** A verdict must clear both bars, or it is not reported. */
const MIN_CONFIDENCE = 55;
const MIN_MARGIN = 15;

const NETWORK = /net::ERR_|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_UNSAFE_PORT|ERR_ABORTED/i;
const LOCATOR_MISSING = /toBeVisible|element\(s\) not found|locator resolved to 0|waiting for locator|strict mode violation/i;
const VALUE_MISMATCH = /toContainText|toHaveURL|toHaveText|toHaveTitle|toHaveValue|toHaveCount|toEqual|toBe\b|toBeLessThan|toBeGreaterThan|expect\(received\)/i;
const TIMEOUT = /timeout .*exceeded|Test timeout of/i;

function firstLine(message: string): string {
  return message.split("\n")[0].slice(0, 120);
}

export function classifyRun(input: ClassifyInput): Map<string, Verdict> {
  const failures = input.results.filter((r) => r.status === "fail" || r.status === "error");

  // A network error hitting nearly the whole run is the app being unreachable,
  // not many separate bugs appearing at once.
  const networkFailures = failures.filter((r) => r.errorMessage && NETWORK.test(r.errorMessage));
  const runIsUnreachable =
    input.results.length > 1 &&
    networkFailures.length >= Math.max(2, Math.ceil(input.results.length * 0.6));

  const out = new Map<string, Verdict>();

  for (const result of failures) {
    const message = result.errorMessage ?? "";
    const evidence: Evidence[] = [];
    const score: Record<FailureClass, number> = {
      environment: 0,
      "test-drift": 0,
      flaky: 0,
      "real-bug": 0,
      unclassified: 0,
    };

    const add = (category: FailureClass, weight: number, signal: string, detail: string) => {
      score[category] += weight;
      evidence.push({ signal, category, weight, detail });
    };

    /* ---- Environment ---- */
    if (NETWORK.test(message)) {
      add("environment", 55, "network-error", `Transport failed before the app replied: ${firstLine(message)}`);
      if (runIsUnreachable) {
        add(
          "environment",
          30,
          "run-wide-outage",
          `${networkFailures.length} of ${input.results.length} specs in this run failed the same way, so the target was down rather than the app being wrong.`,
        );
      }
    }

    /* ---- History: flake versus a clean break ---- */
    const history = (result.testCaseId && input.history.get(result.testCaseId)) || [];
    // An outage fails every spec at once, so those results say nothing about
    // whether this one is flaky. Leaving them in made a genuine regression look
    // like it was alternating, because the outage sat between two passes.
    const usable = history.filter((h) => h.classification !== "environment");
    const outagesSkipped = history.length - usable.length;
    const recent = usable.slice(0, 8);
    const passes = recent.filter((h) => h.status === "pass").length;
    const fails = recent.filter((h) => h.status === "fail" || h.status === "error").length;

    if (outagesSkipped > 0) {
      evidence.push({
        signal: "outages-excluded",
        category: "flaky",
        weight: 0,
        detail: `${outagesSkipped} earlier ${outagesSkipped === 1 ? "result was" : "results were"} an environment outage and left out of the history, since an unreachable target says nothing about this spec.`,
      });
    }

    if (recent.length >= 3 && passes > 0 && fails > 0) {
      const updatedAt = (result.testCaseId && input.caseUpdatedAt.get(result.testCaseId)) || null;
      const oldestRecent = recent[recent.length - 1]?.at ?? null;
      const specChangedInWindow =
        updatedAt && oldestRecent ? updatedAt.getTime() > oldestRecent.getTime() : false;

      if (specChangedInWindow) {
        // Mixed outcomes are expected when the spec itself was edited midway,
        // so this says nothing about flakiness.
        add(
          "test-drift",
          20,
          "spec-edited-in-window",
          "The spec was edited during the window these results cover, so the change in outcome follows the edit.",
        );
      } else {
        // Both outcomes being present is not enough. A spec that passed for a
        // while and has failed ever since is a regression - something changed
        // and stayed changed. A flake is one that keeps swapping. Counting the
        // flips is what separates them, and reading only "it has passed and
        // failed" classified a real breakage as flaky.
        let flips = 0;
        for (let i = 1; i < recent.length; i++) {
          if ((recent[i].status === "pass") !== (recent[i - 1].status === "pass")) flips += 1;
        }

        const leadingFails = recent.findIndex((h) => h.status === "pass");
        const cleanBreak = flips <= 1 && leadingFails > 0;

        if (cleanBreak) {
          add(
            "test-drift",
            25,
            "clean-regression",
            `Passed ${passes} times, then failed the last ${leadingFails} runs without recovering. Something changed and stayed changed.`,
          );
          add(
            "real-bug",
            25,
            "clean-regression",
            "A one-way break is equally consistent with the application having regressed.",
          );
        } else if (flips >= 2) {
          add(
            "flaky",
            55,
            "alternating-outcomes",
            `Outcome changed ${flips} times across its last ${recent.length} runs with the spec unchanged, so it is not settling either way.`,
          );
        } else {
          add(
            "flaky",
            20,
            "mixed-history",
            `Produced ${passes} pass and ${fails} fail in its last ${recent.length} runs, but not in a pattern clear enough to call.`,
          );
        }
      }
    } else if (recent.length >= 2 && fails === recent.length) {
      add(
        "real-bug",
        20,
        "deterministic",
        `Failed in all ${recent.length} previous runs too, so it is repeatable rather than intermittent.`,
      );
      add("test-drift", 10, "deterministic", "A repeatable failure is equally consistent with a stale test.");
    }

    /* ---- Error shape ---- */
    if (LOCATOR_MISSING.test(message) && !NETWORK.test(message)) {
      add(
        "test-drift",
        40,
        "locator-not-found",
        "The page was served but the element the test looks for was not there, which is what a moved or renamed element looks like.",
      );
      if (input.hasHealCandidate?.(result)) {
        add(
          "test-drift",
          25,
          "replacement-found",
          "A plausible replacement locator exists, so the element moved rather than disappeared.",
        );
      }
    }

    if (VALUE_MISMATCH.test(message) && !LOCATOR_MISSING.test(message) && !NETWORK.test(message)) {
      add(
        "real-bug",
        45,
        "value-mismatch",
        `The element was found and held the wrong value or state: ${firstLine(message)}`,
      );
    }

    if (TIMEOUT.test(message) && !NETWORK.test(message)) {
      // A timeout is genuinely ambiguous on its own, so it nudges two
      // categories rather than deciding between them.
      add("flaky", 20, "timeout", "Timeouts are a common shape for non-deterministic failures.");
      add("real-bug", 15, "timeout", "A timeout is also what a genuine hang looks like.");
    }

    /* ---- Rank, and refuse a weak or close call ---- */
    const ranked = (Object.keys(score) as FailureClass[])
      .filter((k) => k !== "unclassified")
      .map((k) => ({ k, v: Math.min(100, score[k]) }))
      .sort((a, b) => b.v - a.v);

    const top = ranked[0];
    const runnerUp = ranked[1];
    const decided =
      top && top.v >= MIN_CONFIDENCE && (!runnerUp || top.v - runnerUp.v >= MIN_MARGIN);

    if (decided) {
      out.set(result.id, { classification: top.k, confidence: top.v, evidence });
    } else {
      out.set(result.id, {
        classification: "unclassified",
        confidence: top?.v ?? 0,
        evidence: [
          ...evidence,
          {
            signal: "below-threshold",
            category: "unclassified",
            weight: 0,
            detail: top
              ? `Best guess was ${top.k} at ${top.v}, ${runnerUp ? `with ${runnerUp.k} at ${runnerUp.v} behind it` : "with nothing else close"}. That is short of the ${MIN_CONFIDENCE} floor or the ${MIN_MARGIN} margin, so no verdict is claimed.`
              : "No signal matched this failure.",
          },
        ],
      });
    }
  }

  return out;
}
