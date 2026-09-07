import "server-only";

import type { ApplicationModel, Observation } from "./explore";

/**
 * Turns observations into findings, or discards them.
 *
 * Kept separate from the engines that produce observations because the two
 * questions are different. "The endpoint answered 201 for an address with no
 * @ in it" is a fact. "That is a defect" is a judgement about what the
 * application promised, and it is wrong often enough that it should not be
 * buried inside a crawler.
 *
 * The bar is deliberately high. Every unexpected result is not a defect, and a
 * report where most entries are noise trains its reader to skim - which costs
 * more than the report saves. Anything this cannot argue for is dropped.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export type Classification =
  | "PRODUCT_BUG"
  | "ACCESSIBILITY_DEFECT"
  | "SECURITY_DEFECT"
  | "PERFORMANCE_ISSUE"
  | "ENVIRONMENT_FAILURE"
  | "EXPECTED_BEHAVIOR";

export type Finding = {
  id: string;
  title: string;
  classification: Classification;
  severity: Severity;
  /** 0-100. How sure the reasoning is, not how bad the defect is. */
  confidence: number;
  expected: string;
  actual: string;
  route: string;
  reproduction: string[];
  rootCauseHint: string | null;
  evidence: Record<string, unknown>;
};

let counter = 0;
const id = (prefix: string) => `${prefix}-${String(++counter).padStart(3, "0")}`;

/** Reset between runs so ids are stable within one report. */
export function resetFindingIds() {
  counter = 0;
}

export function deriveFindings(model: ApplicationModel, probed: Observation[]): Finding[] {
  const all = [...model.observations, ...probed];
  const findings: Finding[] = [];

  /* ---- Soft 404 ---- */
  for (const o of all.filter((x) => x.kind === "soft-404")) {
    findings.push({
      id: id("DEF"),
      title: "A missing resource is served with HTTP 200",
      classification: "PRODUCT_BUG",
      severity: "medium",
      confidence: 95,
      expected: "A resource that does not exist answers 404, so caches, crawlers and API clients can tell success from absence.",
      actual: `${o.detail}. The body says the resource is missing while the status line reports success.`,
      route: o.route,
      reproduction: [`Request ${(o.evidence as { url?: string }).url ?? o.route}`, "Read the HTTP status line", "Read the rendered body"],
      rootCauseHint: "The handler returns markup for the missing case instead of calling the framework's not-found path.",
      evidence: o.evidence,
    });
  }

  /* ---- Server errors ---- */
  for (const o of all.filter((x) => x.kind === "http-status" && /50\d/.test(x.detail))) {
    findings.push({
      id: id("DEF"),
      title: `Server error: ${o.detail}`,
      classification: "PRODUCT_BUG",
      severity: "high",
      confidence: 90,
      expected: "A malformed or unsupported request is refused with a 4xx, not a server error.",
      actual: o.detail,
      route: o.route,
      reproduction: [`Send the request recorded in the evidence to ${o.route}`],
      rootCauseHint: "An unhandled throw reaching the response rather than a validated refusal.",
      evidence: o.evidence,
    });
  }

  /* ---- Accepted input that no reasonable contract allows ---- */
  for (const o of all.filter((x) => x.kind === "no-validation")) {
    const isApi = /accepted/.test(o.detail);
    findings.push({
      id: id("DEF"),
      title: isApi ? `Input accepted without validation: ${o.detail}` : "A form submits with every field empty",
      classification: "PRODUCT_BUG",
      severity: "low",
      confidence: isApi ? 80 : 65,
      expected: isApi
        ? "Input that cannot be a valid value for its field is refused with 4xx."
        : "Submitting an empty form reports what is required, or does nothing.",
      actual: o.detail,
      route: o.route,
      reproduction: isApi
        ? [`POST ${o.route}`, `Body: ${JSON.stringify((o.evidence as { sent?: unknown }).sent ?? {})}`, "Observe the status"]
        : [`Open ${o.route}`, "Submit without filling anything", "Observe that nothing is reported"],
      rootCauseHint: isApi ? "The handler checks presence but not shape." : null,
      evidence: o.evidence,
    });
  }

  /* ---- Input echoed back ---- */
  for (const o of all.filter((x) => x.kind === "unhandled-input")) {
    findings.push({
      id: id("SEC"),
      title: "Submitted input is interpolated into the page as markup",
      classification: "SECURITY_DEFECT",
      severity: "high",
      // The browser parsing the payload into a node is the proof. Reflection
      // as text is normal and no longer reported at all.
      confidence: 90,
      expected: "Input is escaped before it reaches the page, so a value containing markup renders as text rather than becoming an element.",
      actual: o.detail,
      route: o.route,
      reproduction: [
        `Open ${o.route}`,
        "Enter the probe value from the evidence into the first field",
        "Submit",
        `Run document.querySelector("${(o.evidence as { marker?: string }).marker ?? "the marker in the evidence"}") in the console`,
      ],
      rootCauseHint: null,
      evidence: o.evidence,
    });
  }

  /* ---- Accessibility ---- */
  for (const o of all.filter((x) => x.kind === "missing-heading")) {
    findings.push({
      id: id("A11Y"),
      title: "Page renders content with no heading",
      classification: "ACCESSIBILITY_DEFECT",
      severity: "low",
      confidence: 90,
      expected: "Every page that renders content names itself with a heading, so a screen reader can announce where the user has landed.",
      actual: o.detail,
      route: o.route,
      reproduction: [`Open ${o.route}`, "Query the document for h1 and h2 elements"],
      rootCauseHint: null,
      evidence: o.evidence,
    });
  }

  for (const o of all.filter((x) => x.kind === "unlabelled-input")) {
    findings.push({
      id: id("A11Y"),
      title: "Form field with no accessible name",
      classification: "ACCESSIBILITY_DEFECT",
      severity: "medium",
      confidence: 90,
      expected: "Every field has a label, aria-label or aria-labelledby, so it can be announced and addressed by name.",
      actual: o.detail,
      route: o.route,
      reproduction: [`Open ${o.route}`, "Inspect inputs for an accessible name"],
      rootCauseHint: null,
      evidence: o.evidence,
    });
  }

  /* ---- Console errors: grouped, because one fault produces many lines ---- */
  const consoleByRoute = new Map<string, Observation[]>();
  for (const o of all.filter((x) => x.kind === "console-error")) {
    consoleByRoute.set(o.route, [...(consoleByRoute.get(o.route) ?? []), o]);
  }
  for (const [route, group] of consoleByRoute) {
    findings.push({
      id: id("DEF"),
      title: `Console errors on ${route}`,
      classification: "PRODUCT_BUG",
      severity: "low",
      confidence: 60,
      expected: "A page loads without writing errors to the console.",
      actual: `${group.length} console error(s). First: ${group[0].detail}`,
      route,
      reproduction: [`Open ${route}`, "Read the browser console"],
      rootCauseHint: null,
      evidence: { count: group.length, samples: group.slice(0, 3).map((g) => g.detail) },
    });
  }

  /* ---- Performance ---- */
  for (const o of all.filter((x) => x.kind === "slow-response")) {
    findings.push({
      id: id("PERF"),
      title: `Slow response on ${o.route}`,
      classification: "PERFORMANCE_ISSUE",
      severity: "low",
      confidence: 70,
      expected: "A page reaches first paint well inside three seconds on a local application.",
      actual: o.detail,
      route: o.route,
      reproduction: [`Open ${o.route}`, "Measure time to DOMContentLoaded"],
      rootCauseHint: null,
      evidence: o.evidence,
    });
  }

  return dedupe(findings);
}

/**
 * One underlying fault should be one finding.
 *
 * A crawl that visits eight pages sharing a broken header would otherwise
 * report the same console error eight times, and a reader would count eight
 * defects.
 */
function dedupe(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.classification}:${f.title}:${f.route}`;
    const existing = byKey.get(key);
    if (!existing || f.confidence > existing.confidence) byKey.set(key, f);
  }
  return [...byKey.values()].sort((a, b) => {
    const order: Severity[] = ["critical", "high", "medium", "low"];
    return order.indexOf(a.severity) - order.indexOf(b.severity) || b.confidence - a.confidence;
  });
}
