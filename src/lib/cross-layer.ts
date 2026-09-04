import "server-only";

import type { Evidence, FailureClass, Verdict } from "./failure-classifier";

/**
 * Adjusts a UI-only verdict using what the layers underneath were doing.
 *
 * A UI assertion failure is ambiguous by construction: "the element was not
 * there" reads identically whether the API that fills it returned 500 or the
 * element was simply renamed. Phase 1 sees only the first layer, so it cannot
 * separate those - it will give the same answer to a genuine server fault and
 * to a stale test.
 *
 * This looks at the responses the page actually received during that spec, and
 * at what the browser logged, and moves the verdict accordingly. It only ever
 * adjusts an existing verdict: the correlation is evidence about a failure, not
 * a second opinion formed independently.
 */

export type NetworkEvent = {
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  body: string | null;
  failure: string | null;
  ms: number;
};

export type CorrelatedVerdict = Verdict & {
  /** What the UI-only pass concluded, kept so the change is inspectable. */
  uiOnly: { classification: FailureClass; confidence: number };
  crossLayer: boolean;
};

/** Page loads are not the app's own API surface; those are the interesting ones. */
function isApiCall(event: NetworkEvent): boolean {
  return /\/api\//.test(event.url) && !event.url.includes("_rsc=");
}

/**
 * A cancelled request is not a broken one.
 *
 * Frameworks prefetch routes and abandon the ones the user does not take, so a
 * page load leaves several ERR_ABORTED entries behind as a matter of course.
 * Reading those as an outage classified a perfectly reachable app as an
 * environment failure, which is worse than not looking at all - the correlation
 * has to reject its own noise before it is worth trusting.
 */
function isRealTransportFailure(event: NetworkEvent): boolean {
  if (!event.failure) return false;
  if (/ERR_ABORTED/i.test(event.failure)) return false;
  // Framework prefetches are speculative; losing one costs the page nothing.
  if (event.url.includes("_rsc=")) return false;
  return true;
}

const ADJUSTED_MAX = 95;

export function correlate(
  verdict: Verdict,
  network: NetworkEvent[] | null,
  consoleLog: string | null,
): CorrelatedVerdict {
  const uiOnly = { classification: verdict.classification, confidence: verdict.confidence };
  const base: CorrelatedVerdict = { ...verdict, uiOnly, crossLayer: false };

  if (!network || network.length === 0) {
    return {
      ...base,
      evidence: [
        ...verdict.evidence,
        {
          signal: "no-lower-layer",
          category: verdict.classification,
          weight: 0,
          detail:
            "Nothing was captured beneath the UI for this spec, so this verdict rests on the interface alone.",
        },
      ],
    };
  }

  const apiCalls = network.filter(isApiCall);
  const serverErrors = network.filter((e) => (e.status ?? 0) >= 500);
  const clientErrors = network.filter((e) => (e.status ?? 0) >= 400 && (e.status ?? 0) < 500);
  const transportFailures = network.filter(isRealTransportFailure);
  const pageErrors = (consoleLog ?? "").split("\n").filter((l) => l.startsWith("PAGEERROR"));

  const evidence: Evidence[] = [...verdict.evidence];
  let classification = verdict.classification;
  let confidence = verdict.confidence;

  const note = (signal: string, weight: number, detail: string, category: FailureClass = classification) =>
    evidence.push({ signal, category, weight, detail });

  /* ---- The app answered with a fault ---- */
  if (serverErrors.length > 0) {
    const worst = serverErrors[0];
    classification = "real-bug";
    confidence = Math.min(ADJUSTED_MAX, Math.max(confidence, 70) + 20);
    note(
      "api-server-error",
      20,
      `The UI failed and underneath it ${worst.method} ${worst.url.replace(/^https?:\/\/[^/]+/, "")} returned ${worst.status}${worst.body ? ` - ${worst.body.slice(0, 120)}` : ""}. The interface is reporting a fault the server actually had, so this is the application misbehaving rather than the test being stale.`,
      "real-bug",
    );
  } else if (transportFailures.length > 0 && classification !== "environment") {
    const worst = transportFailures[0];
    classification = "environment";
    confidence = Math.min(ADJUSTED_MAX, Math.max(confidence, 70));
    note(
      "transport-failed",
      20,
      `A request the page made never completed: ${worst.method} ${worst.url.replace(/^https?:\/\/[^/]+/, "")} - ${worst.failure}. The app was not reached, whatever the interface showed.`,
      "environment",
    );
  } else if (apiCalls.length > 0) {
    /* ---- The backend was reached and did not fault ---- */
    // Deliberately not "every response was 2xx". A 409 telling the page that an
    // account already exists is the application working, and treating it as
    // suspicious would punish an app for handling a case properly. What matters
    // is that nothing faulted: no 5xx, and nothing failed to complete.
    if (classification === "real-bug" || classification === "unclassified") {
      // The strongest case this phase makes: the UI said something is wrong and
      // nothing underneath faulted. That points at the test's expectations
      // rather than at the application. It applies to an undecided verdict too
      // - a UI symptom the interface alone could not read is exactly where the
      // layer below is worth the most.
      classification = "test-drift";
      confidence = Math.max(60, Math.min(ADJUSTED_MAX, confidence));
      note(
        "api-clean-under-ui-failure",
        25,
        `The ${apiCalls.length} API ${apiCalls.length === 1 ? "call" : "calls"} this spec made all completed and none faulted (${apiCalls.map((c) => c.status).join(", ")}), so the server did what it was asked. A UI failure over a backend that did not fault is far more often a test that no longer matches the page than an application fault.`,
        "test-drift",
      );
    } else if (classification === "flaky") {
      // Flakiness is a claim about behaviour over time; one clean run underneath
      // does not refute it. The observation is still worth recording, because
      // "nothing faulted" is exactly what rules out the server as the cause.
      note(
        "api-clean-not-a-server-fault",
        0,
        `The ${apiCalls.length} API ${apiCalls.length === 1 ? "call" : "calls"} completed without faulting (${apiCalls.map((c) => c.status).join(", ")}), so whatever is making this spec inconsistent, it is not the server erroring. The verdict is left as it stands, since a single clean run cannot settle a question about behaviour over time.`,
        "flaky",
      );
    } else if (classification === "test-drift") {
      confidence = Math.min(ADJUSTED_MAX, confidence + 15);
      note(
        "api-clean-confirms-drift",
        15,
        `The ${apiCalls.length} API ${apiCalls.length === 1 ? "call" : "calls"} completed without faulting (${apiCalls.map((c) => c.status).join(", ")}), which agrees with the interface having moved rather than the application having broken.`,
        "test-drift",
      );
    }
  }

  const authRefusals = clientErrors.filter((e) => e.status === 401 || e.status === 403);
  if (authRefusals.length > 0) {
    note(
      "api-unauthorised",
      10,
      `${authRefusals[0].method} ${authRefusals[0].url.replace(/^https?:\/\/[^/]+/, "")} returned ${authRefusals[0].status}. A refused request is a setup problem as often as an application one, so this verdict is held less firmly.`,
    );
    confidence = Math.max(0, confidence - 10);
  }

  if (pageErrors.length > 0) {
    note(
      "browser-exception",
      10,
      `The page threw ${pageErrors.length} unhandled ${pageErrors.length === 1 ? "error" : "errors"} in the browser: ${pageErrors[0].slice(0, 140)}. Client-side code failing is the application misbehaving, whatever the server returned.`,
      "real-bug",
    );
    if (classification !== "environment") {
      classification = "real-bug";
      confidence = Math.min(ADJUSTED_MAX, Math.max(confidence, 75));
    }
  }

  const changed = classification !== uiOnly.classification || confidence !== uiOnly.confidence;
  if (changed) {
    note(
      "cross-layer-adjustment",
      0,
      `Reading the UI alone gave ${uiOnly.classification} at ${uiOnly.confidence}. With the layers underneath it, this is ${classification} at ${confidence}.`,
      classification,
    );
  }

  return { classification, confidence, evidence, uiOnly, crossLayer: changed };
}
