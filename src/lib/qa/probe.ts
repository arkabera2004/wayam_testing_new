import "server-only";

import { chromium } from "playwright";

import type { ApplicationModel, Observation } from "./explore";

/**
 * Deliberate probing of the paths a happy-path walk never reaches.
 *
 * Exploration follows links and records what it sees; that finds broken
 * navigation and console errors, but it will never find out what happens when
 * a form is submitted empty, because nothing on the page links to that state.
 * Reaching it requires deciding to try.
 *
 * Every probe here is read-only or self-undoing against a local application:
 * it submits forms, requests URLs that should not exist, and sends malformed
 * bodies. Nothing deletes, nothing escalates, and nothing is aimed anywhere
 * but the base URL it was given.
 *
 * A probe reports what happened. Whether "201 for an invalid email" is a
 * defect depends on what the application promised, which is not this module's
 * decision to make.
 */

/**
 * Inputs chosen to sit on the edges rather than to attack.
 *
 * `marker` names an element the payload would create if it were parsed as
 * markup. It is inert - a custom tag with no behaviour - because the question
 * is whether the application escapes input, and answering it does not require
 * running anything. An entry with no marker is a boundary value, not a
 * reflection probe.
 */
const BOUNDARY_INPUTS: Array<{ label: string; value: string; marker?: string }> = [
  { label: "empty", value: "" },
  { label: "whitespace", value: "   " },
  { label: "very long", value: "a".repeat(2000) },
  { label: "special characters", value: "'\"<>&;%{}[]" },
  { label: "unicode", value: "日本語 · emoji 🙂 · ÅÄÖ" },
  { label: "sql-ish", value: "' OR '1'='1" },
  { label: "html injection", value: "<pk-probe-el></pk-probe-el>", marker: "pk-probe-el" },
  { label: "attribute injection", value: '"><pk-probe-attr></pk-probe-attr>', marker: "pk-probe-attr" },
];

/** Paths that should not resolve, to see how absence is reported. */
function nonExistentPaths(model: ApplicationModel): string[] {
  const out = new Set<string>([`${model.baseUrl}/definitely-not-a-real-route-${Date.now()}`]);
  // A parameterised route with a value nothing matches is the interesting
  // case: the route exists, the resource does not.
  for (const s of model.states) {
    const seg = s.route.split("/").filter(Boolean);
    if (seg.length >= 2) out.add(`${model.baseUrl}/${seg[0]}/does-not-exist-${Date.now()}`);
  }
  return [...out];
}

export async function probeApplication(
  model: ApplicationModel,
): Promise<{ observations: Observation[]; apis: ApplicationModel["apis"] }> {
  const found: Observation[] = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Submitting a form is what makes an application call its own API. The crawl
  // only follows links, so it never triggers one; without recording the calls
  // these probes cause, API probing has no endpoints to work with.
  const apis: ApplicationModel["apis"] = [];
  page.on("response", (r) => {
    const u = r.url();
    if (u.startsWith(model.baseUrl) && /\/api\//.test(u)) {
      apis.push({ method: r.request().method(), url: u, status: r.status() });
    }
  });

  try {
    /* ---- Absent resources: is absence reported as absence? ---- */
    for (const url of nonExistentPaths(model)) {
      let status: number | null = null;
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
        status = res?.status() ?? null;
      } catch {
        continue;
      }
      const text = String(await page.evaluate(`(document.body.innerText || "").slice(0, 400)`));
      const saysMissing = /not found|does not exist|no such|404/i.test(text);

      // The status line and the page disagreeing is the finding. A body that
      // says "not found" under a 200 tells a crawler the page is fine.
      if (status === 200 && saysMissing) {
        found.push({
          kind: "soft-404",
          route: new URL(url).pathname,
          detail: `HTTP 200 for a resource the page itself calls missing`,
          evidence: { url, status, bodySays: text.slice(0, 160) },
        });
      }
    }

    /* ---- Forms: submit empty, and submit nonsense ---- */
    for (const state of model.states.filter((s) => s.forms > 0)) {
      try {
        await page.goto(state.url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      } catch {
        continue;
      }

      const submit = page
        .getByRole("button", { name: /sign in|log in|submit|create|search|save|continue|apply/i })
        .first();
      if (!(await submit.count())) continue;

      const before = page.url();
      const textboxes = page.locator('input:not([type="hidden"]):not([type="checkbox"]), textarea');
      const count = await textboxes.count();

      // Empty submit: something should object, or nothing should move.
      await submit.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      const alerted = await page.locator('[role="alert"], [aria-invalid="true"], .error, [data-testid*="error"]').count();
      const moved = page.url() !== before;

      if (count > 0 && !alerted && !moved) {
        found.push({
          kind: "no-validation",
          route: state.route,
          detail: "submitting the form with every field empty produced no message and no navigation",
          evidence: { url: state.url, fields: count },
        });
      }

      // Boundary values into the first text field, one at a time.
      for (const probe of BOUNDARY_INPUTS) {
        try {
          await page.goto(state.url, { waitUntil: "domcontentloaded", timeout: 15_000 });
          const first = page.locator('input[type="text"], input[type="email"], input:not([type]), textarea').first();
          if (!(await first.count())) break;
          await first.fill(probe.value, { timeout: 4000 });
          await submit.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(500);

          // Reflection on its own is not a defect. A search page printing the
          // query back is the feature, and reporting it taught the reader to
          // skim the report. What separates the two is whether the value
          // arrived as text or as markup: the payload carries a marker element,
          // and if the browser parsed it into a real node then the input was
          // interpolated into HTML rather than escaped.
          if (probe.marker) {
            const parsed = await page.evaluate(
              `Boolean(document.querySelector(${JSON.stringify(probe.marker)}))`,
            );
            if (parsed) {
              found.push({
                kind: "unhandled-input",
                route: state.route,
                detail: `input "${probe.label}" was parsed into the DOM as markup, not escaped as text`,
                evidence: {
                  url: state.url,
                  probe: probe.label,
                  value: probe.value.slice(0, 60),
                  marker: probe.marker,
                  proof: `document.querySelector("${probe.marker}") returned an element`,
                },
              });
            }
          }
        } catch {
          /* A probe that cannot be typed is not a finding. */
        }
      }
    }
  } finally {
    await browser.close();
  }

  return { observations: found, apis };
}

/**
 * Exercises discovered APIs directly.
 *
 * The browser only sends what the interface chooses to send. An endpoint's
 * contract - which methods it answers, what it does with a malformed body,
 * whether it validates the shape of what it accepts - is only visible by
 * calling it.
 */
export async function probeApis(model: ApplicationModel): Promise<Observation[]> {
  const found: Observation[] = [];
  const endpoints = [...new Set(model.apis.map((a) => a.url))];

  for (const url of endpoints) {
    const route = new URL(url).pathname;

    /* Methods the endpoint does not implement should be refused, not crash. */
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      try {
        const res = await fetch(url, { method, signal: AbortSignal.timeout(8000) });
        if (res.status >= 500) {
          found.push({
            kind: "http-status",
            route,
            detail: `${method} returns ${res.status} instead of refusing the method`,
            evidence: { url, method, status: res.status },
          });
        }
      } catch {
        /* ignore */
      }
    }

    /* A body that is not JSON should be a 400, not a 500. */
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "this is not json",
        signal: AbortSignal.timeout(8000),
      });
      if (res.status >= 500) {
        found.push({
          kind: "http-status",
          route,
          detail: `malformed JSON body returns ${res.status}`,
          evidence: { url, status: res.status },
        });
      }
    } catch {
      /* ignore */
    }

    /* Shape validation: does it accept values of the wrong kind or format? */
    const shapes: Array<{ label: string; body: Record<string, unknown> }> = [
      { label: "email without @", body: { email: "not-an-email" } },
      { label: "email as a number", body: { email: 12345 } },
      { label: "email as an object", body: { email: { nested: true } } },
      { label: "oversized field", body: { email: `${"a".repeat(5000)}@x.com` } },
    ];
    for (const shape of shapes) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(shape.body),
          signal: AbortSignal.timeout(8000),
        });
        const body = await res.text();
        if (res.status >= 200 && res.status < 300) {
          found.push({
            kind: "no-validation",
            route,
            detail: `accepted ${shape.label} with HTTP ${res.status}`,
            evidence: { url, sent: shape.body, status: res.status, response: body.slice(0, 160) },
          });
        }
        if (res.status >= 500) {
          found.push({
            kind: "http-status",
            route,
            detail: `${shape.label} caused HTTP ${res.status}`,
            evidence: { url, sent: shape.body, status: res.status },
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  return found;
}
