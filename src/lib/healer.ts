import "server-only";

import { chromium, type Browser, type Page } from "playwright";

/**
 * Finds a working replacement for a selector that no longer matches.
 *
 * The browser is deliberately pluggable. Browser Use hands back a cdp_url, and
 * Playwright attaches to any CDP endpoint, so the same healing logic runs
 * against a cloud session or a local Chromium without branching. Local is the
 * default because it needs no key and no billing; set BROWSER_USE_CDP_URL (or
 * BROWSER_USE_API_KEY, which is exchanged for one) to use the remote session.
 */
export type HealCandidate = {
  selector: string;
  strategy: "role-name" | "test-id" | "label" | "text";
  similarity: number;
  reason: string;
};

export type HealResult = {
  url: string;
  brokenSelector: string;
  healed: HealCandidate | null;
  candidates: HealCandidate[];
  browser: "local" | "remote";
};

const BROWSER_USE_API = "https://api.browser-use.com/api/v2";

/**
 * Rents a cloud browser and returns its CDP endpoint.
 *
 * Billing runs from creation until the session is stopped, so the caller must
 * stop it in a finally — a thrown error mid-heal would otherwise leave a
 * session running until its timeout.
 */
async function createRemoteSession(apiKey: string) {
  const res = await fetch(`${BROWSER_USE_API}/browsers`, {
    method: "POST",
    headers: { "X-Browser-Use-API-Key": apiKey, "content-type": "application/json" },
    // Short timeout: a heal is seconds of work, and this bounds the cost if
    // something here throws before the stop call.
    body: JSON.stringify({ proxyCountryCode: "us", timeout: 5 }),
  });
  if (!res.ok) throw new Error(`Browser Use rejected the session request (${res.status})`);

  const data = (await res.json()) as { id: string; cdpUrl?: string; cdp_url?: string };
  const cdpUrl = data.cdpUrl ?? data.cdp_url;
  if (!cdpUrl) throw new Error("Browser Use returned no CDP url");
  return { id: data.id, cdpUrl };
}

/**
 * Ends a rented session.
 *
 * Stopping is PATCH with an action, not POST /stop — that path 404s, and
 * because the failure was being swallowed the session stayed billable until
 * its own timeout. A failure here is logged rather than ignored: a silent
 * leak costs money.
 */
async function stopRemoteSession(apiKey: string, id: string) {
  try {
    const res = await fetch(`${BROWSER_USE_API}/browsers/${id}`, {
      method: "PATCH",
      headers: { "X-Browser-Use-API-Key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    if (!res.ok) {
      console.error(`Browser Use session ${id} did not stop (${res.status}); it stays billable.`);
    }
  } catch (err) {
    console.error(`Browser Use session ${id} could not be stopped:`, err);
  }
}

/**
 * Opens a browser for healing.
 *
 * Browser Use hands back a CDP endpoint and Playwright attaches to any CDP
 * endpoint, so the healing logic below is identical either way. Local is the
 * default because it costs nothing; the remote session is used when a key is
 * present, or when BROWSER_USE_CDP_URL points at an already-running one.
 */
/**
 * Whether a rented browser could actually reach this URL.
 *
 * A cloud session has no route to the machine running the app, so healing a
 * localhost page in a remote browser fails with ERR_CONNECTION_REFUSED and
 * still bills for the session. Those URLs stay local regardless of the key.
 */
function isReachableFromCloud(url: string) {
  try {
    const { hostname } = new URL(url);
    if (hostname === "localhost" || hostname.endsWith(".local")) return false;
    if (/^127\./.test(hostname) || hostname === "::1") return false;
    // RFC1918 private ranges.
    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function openBrowser(targetUrl: string): Promise<{
  browser: Browser;
  kind: "local" | "remote";
  release: () => Promise<void>;
}> {
  const existing = process.env.BROWSER_USE_CDP_URL;
  if (existing) {
    return { browser: await chromium.connectOverCDP(existing), kind: "remote", release: async () => {} };
  }

  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (apiKey && process.env.HEAL_BROWSER !== "local" && isReachableFromCloud(targetUrl)) {
    const session = await createRemoteSession(apiKey);
    return {
      browser: await chromium.connectOverCDP(session.cdpUrl),
      kind: "remote",
      release: () => stopRemoteSession(apiKey, session.id),
    };
  }

  return { browser: await chromium.launch(), kind: "local", release: async () => {} };
}

/**
 * Element kind implied by the broken selector.
 *
 * "#pay-btn" and "#search-btn" name buttons, and without this the ranker
 * happily proposed a nav link with the same words — a locator that matches
 * something real and wrong, which is worse than not healing at all.
 */
function impliedRole(selector: string): string | null {
  const s = selector.toLowerCase();
  if (/\bbtn\b|button|submit|cta/.test(s)) return "button";
  if (/\blink\b|anchor|nav/.test(s)) return "link";
  if (/input|field|textbox|search-?box/.test(s)) return "textbox";
  return null;
}

/** Strategies ordered by how well they survive markup churn. */
const STRATEGY_RANK: Record<HealCandidate["strategy"], number> = {
  "test-id": 3,
  label: 2,
  "role-name": 1,
  text: 0,
};

/** Cheap token overlap, enough to rank a handful of candidates. */
function similarity(a: string, b: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const A = new Set(norm(a));
  const B = new Set(norm(b));
  if (A.size === 0 || B.size === 0) return 0;
  const shared = [...A].filter((t) => B.has(t)).length;
  return Math.round((shared / Math.max(A.size, B.size)) * 100);
}

/**
 * Pulls the identifying attributes off every interactive element on the page.
 * Runs in the page so it sees the DOM as rendered, not as served.
 */
async function collectCandidates(page: Page) {
  return page.evaluate(() => {
    const interactive = [...document.querySelectorAll("button, a[href], input, select, textarea, [role=button]")];
    return interactive.slice(0, 200).map((el) => {
      const e = el as HTMLElement;
      return {
        tag: e.tagName.toLowerCase(),
        role: e.getAttribute("role") ?? (e.tagName === "BUTTON" ? "button" : e.tagName === "A" ? "link" : ""),
        text: (e.innerText || "").trim().slice(0, 80),
        testId: e.getAttribute("data-testid") ?? "",
        label: e.getAttribute("aria-label") ?? "",
        id: e.id ?? "",
        cls: e.className?.toString().slice(0, 120) ?? "",
      };
    });
  });
}

/**
 * Attempts to heal one selector against a live page.
 *
 * The broken selector is used as the search text — "#pay-btn" still carries
 * the word "pay", which is usually enough to find the control that replaced
 * it. Candidates are ranked and the best is returned; ties keep the most
 * stable strategy, preferring a test id or an accessible name over text.
 */
export async function healSelector(url: string, brokenSelector: string): Promise<HealResult> {
  const { browser, kind, release } = await openBrowser(url);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });

    // If it still matches, there is nothing to heal.
    const stillWorks = await page
      .locator(brokenSelector)
      .count()
      .then((n) => n > 0)
      .catch(() => false);
    if (stillWorks) {
      return { url, brokenSelector, healed: null, candidates: [], browser: kind };
    }

    const raw = await collectCandidates(page);
    const needle = brokenSelector.replace(/[#.\[\]'"=>]/g, " ");
    const wantRole = impliedRole(brokenSelector);

    const candidates: HealCandidate[] = [];
    for (const c of raw) {
      const name = c.label || c.text;
      // The implied role gates every strategy, not just role-name. Without
      // this a label on a text input outranked the button the broken selector
      // actually named, purely because labels are the more stable strategy.
      const effectiveRole = c.role || (c.tag === "input" || c.tag === "textarea" ? "textbox" : c.tag);
      const rolePenalty = wantRole && effectiveRole !== wantRole ? -35 : 0;
      if (c.testId) {
        candidates.push({
          selector: `getByTestId('${c.testId}')`,
          strategy: "test-id",
          similarity: Math.max(0, Math.max(similarity(needle, c.testId), 60) + rolePenalty),
          reason: "Matched a stable test id on the element that replaced it.",
        });
      }
      if (c.label) {
        candidates.push({
          selector: `getByLabel('${c.label}')`,
          strategy: "label",
          similarity: Math.max(0, similarity(needle, c.label) + rolePenalty),
          reason: "Matched the accessible label, which survives class and id changes.",
        });
      }
      if (c.role && name) {
        const roleMatches = wantRole ? effectiveRole === wantRole : true;
        candidates.push({
          selector: `getByRole('${c.role}', { name: '${name.replace(/'/g, "\\'")}' })`,
          strategy: "role-name",
          // A role that contradicts the broken selector is penalised rather
          // than dropped, so it can still surface if nothing better exists.
          similarity: Math.max(0, similarity(needle, name) + rolePenalty),
          reason: roleMatches
            ? `Matched by role and accessible name${wantRole ? `; the original selector named a ${wantRole}` : ""}.`
            : `Name matches but this is a ${c.role}, not the ${wantRole} the old selector named.`,
        });
      }
    }

    // Score first, then prefer the strategy that survives markup churn, so a
    // tie never resolves on DOM order.
    candidates.sort(
      (a, b) => b.similarity - a.similarity || STRATEGY_RANK[b.strategy] - STRATEGY_RANK[a.strategy],
    );
    const best = candidates[0] ?? null;

    return {
      url,
      brokenSelector,
      // A weak match is worse than none: proposing a wrong locator turns a
      // visible failure into a test that passes against the wrong element.
      healed: best && best.similarity >= 30 ? best : null,
      candidates: candidates.slice(0, 5),
      browser: kind,
    };
  } finally {
    await browser.close().catch(() => {});
    // Stops the meter on a rented session.
    await release();
  }
}
