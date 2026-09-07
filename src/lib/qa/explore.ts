import "server-only";

import { chromium, type Page } from "playwright";

/**
 * Autonomous exploration of a running application.
 *
 * The difference between this and spec generation is what it reads. Spec
 * generation reads the repository and turns routes into "the page responds".
 * This drives the application, looks at what is actually on the screen, and
 * decides what to do next from that - so it can reach a state the source never
 * described and notice something the suite was never asked about.
 *
 * It is a breadth-first walk over states, not a script. A state is a URL plus
 * the shape of what is interactive on it, because the same URL with a modal
 * open is a different place to be. Visited states are remembered so the walk
 * terminates rather than circling the navigation bar forever.
 *
 * Discovery is separated from judgement on purpose. This module reports what
 * it saw - statuses, console errors, failed requests, unlabelled inputs,
 * validation that did not fire - and says nothing about severity. Deciding
 * which of those is a defect is a different job, done in findings.ts, because
 * an observation that is a bug in one application is the intended behaviour in
 * another.
 */

export type Observation = {
  kind:
    | "http-status"
    | "console-error"
    | "request-failed"
    | "soft-404"
    | "missing-heading"
    | "unlabelled-input"
    | "no-validation"
    | "unhandled-input"
    | "slow-response";
  route: string;
  detail: string;
  evidence: Record<string, unknown>;
};

export type InteractiveElement = {
  role: string;
  name: string;
  tag: string;
  testId: string | null;
  /** How this element would be addressed semantically, never by position. */
  locator: string;
};

export type ExploredState = {
  url: string;
  route: string;
  status: number | null;
  title: string;
  headings: string[];
  elements: InteractiveElement[];
  forms: number;
  /** Signature used to decide "have I been here before". */
  signature: string;
};

export type ApplicationModel = {
  baseUrl: string;
  states: ExploredState[];
  routes: string[];
  apis: Array<{ method: string; url: string; status: number }>;
  observations: Observation[];
  actionsTaken: number;
};

/** Deepest directory every successfully-loaded page shares. */
function commonPrefix(paths: string[]): string {
  if (!paths.length) return "";
  const split = paths.map((p) => p.split("/").filter(Boolean));
  const first = split[0];
  const out: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const seg = first[i];
    if (split.every((s) => s[i] === seg)) out.push(seg);
    else break;
  }
  return out.length ? `/${out.join("/")}` : "";
}

const MAX_STATES = 40;
const MAX_ACTIONS = 120;
const SLOW_MS = 3000;

/** Same page, same interactive shape: somewhere already explored. */
function signatureOf(route: string, elements: InteractiveElement[]): string {
  const shape = elements
    .map((e) => `${e.role}:${e.name}`)
    .sort()
    .join("|");
  return `${route}#${shape}`;
}

function routeOf(url: string, baseUrl: string): string {
  try {
    const u = new URL(url);
    const b = new URL(baseUrl);
    const path = u.pathname.startsWith(b.pathname) ? u.pathname.slice(b.pathname.length) : u.pathname;
    return path || "/";
  } catch {
    return url;
  }
}

/**
 * Reads what is interactive, the way a person would look at a screen.
 *
 * Role and accessible name first, because that is what the element *is* and
 * what it is *called* - both survive a class rename and a DOM reshuffle. The
 * test id is recorded when present but never preferred: an application that
 * has them is lucky, and one that does not still has to be explorable.
 */
async function readElements(page: Page): Promise<InteractiveElement[]> {
  return page.evaluate(`(() => {
    const sel = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"]';
    const out = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const tag = el.tagName.toLowerCase();
      const explicitRole = el.getAttribute("role");
      const role = explicitRole
        || (tag === "a" ? "link"
        : tag === "button" ? "button"
        : tag === "select" ? "combobox"
        : tag === "textarea" ? "textbox"
        : tag === "input" ? ((el.getAttribute("type") || "text") === "submit" ? "button" : "textbox")
        : tag);
      const labelFor = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
      const name = (el.getAttribute("aria-label")
        || (labelFor && labelFor.textContent)
        || el.getAttribute("placeholder")
        || el.getAttribute("value")
        || (el.innerText || "")).trim().slice(0, 60);
      out.push({
        role,
        name,
        tag,
        testId: el.getAttribute("data-testid"),
        locator: name ? "getByRole('" + role + "', { name: '" + name.replace(/'/g, "\\\\'") + "' })" : tag,
      });
    }
    return out;
  })()`);
}

async function readState(page: Page, baseUrl: string, status: number | null): Promise<ExploredState> {
  const elements = await readElements(page);
  const route = routeOf(page.url(), baseUrl);
  const info = await page.evaluate(`(() => ({
    title: document.title,
    headings: Array.from(document.querySelectorAll("h1,h2")).map(h => h.textContent.trim()).slice(0, 8),
    forms: document.querySelectorAll("form").length,
    bodyText: (document.body.innerText || "").slice(0, 400),
  }))()`) as { title: string; headings: string[]; forms: number; bodyText: string };

  return {
    url: page.url(),
    route,
    status,
    title: info.title,
    headings: info.headings,
    elements,
    forms: info.forms,
    signature: signatureOf(route, elements),
  };
}

/**
 * Walks the application and records what it finds.
 *
 * Navigation is followed by reading links off each state rather than from a
 * route table, so a page reachable only through a button is still reached, and
 * a route in the source that nothing links to is noticed by its absence.
 */
/**
 * Seeds let the walk reach states nothing links to.
 *
 * A link-following crawl can only see what the interface offers from where it
 * is standing, and some states are only reachable by knowing they exist:
 * /checkout is not linked from anywhere while the cart is empty, so a pure
 * crawl concludes it does not exist. Routes already discovered from the source
 * are handed in as starting points - static knowledge aiming the dynamic walk,
 * rather than replacing it.
 */
export async function exploreApplication(baseUrl: string, seedRoutes: string[] = []): Promise<ApplicationModel> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const observations: Observation[] = [];
  const apis: ApplicationModel["apis"] = [];
  const states: ExploredState[] = [];
  const seen = new Set<string>();
  // Seeds are paths relative to the application, and the application is not
  // necessarily mounted at the origin: this storefront lives under
  // /demo/shopstack, so joining a seed straight onto the origin produced a
  // 404 for every one of them. The mount point is learned from where the first
  // navigation actually lands, then seeds are queued against it.
  const seedUrls = new Set<string>();
  const queue: string[] = [baseUrl];
  let actions = 0;

  let currentRoute = "/";

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();

    // "Failed to load resource" is the browser narrating an HTTP response.
    // That response is already recorded as a status observation if it matters,
    // and reporting it again turns one fact into two findings - including for
    // requests this crawler caused itself by submitting a form, which is not
    // the application misbehaving.
    if (/Failed to load resource/i.test(text)) return;

    // The URL is read at the moment the event fires. Reading a mutable
    // "current route" attributed one page's errors to the next one, because
    // console events arrive during navigation and the variable is only
    // updated once goto resolves.
    const at = routeOf(page.url(), baseUrl);

    observations.push({
      kind: "console-error",
      route: at,
      detail: text.slice(0, 200),
      evidence: { route: at, text: text.slice(0, 400), source: "console" },
    });
  });

  // Uncaught exceptions do not arrive as console messages. Playwright raises
  // them on "pageerror", and listening only to the console meant this saw the
  // browser narrating failed downloads and never saw a script actually
  // throwing - so once that narration was filtered out the check could not
  // fire at all. This is the event that carries the fault.
  page.on("pageerror", (err) => {
    const at = routeOf(page.url(), baseUrl);
    observations.push({
      kind: "console-error",
      route: at,
      detail: `${err.name}: ${err.message}`.slice(0, 200),
      evidence: {
        route: at,
        text: `${err.name}: ${err.message}`,
        stack: (err.stack ?? "").split("\n").slice(0, 3).join(" | ").slice(0, 300),
        source: "pageerror",
      },
    });
  });

  page.on("requestfailed", (r) => {
    const failure = r.failure()?.errorText ?? "";
    // Next speculatively prefetches routes and abandons them; treating that as
    // a transport failure would report every page load as broken.
    if (/ERR_ABORTED/.test(failure)) return;
    observations.push({
      kind: "request-failed",
      route: currentRoute,
      detail: `${r.method()} ${r.url()} - ${failure}`,
      evidence: { method: r.method(), url: r.url(), failure },
    });
  });

  page.on("response", (r) => {
    const u = r.url();
    if (!u.startsWith(baseUrl)) return;
    if (/\.(css|js|png|svg|ico|woff2?)$/.test(u)) return;
    if (/\/api\//.test(u)) apis.push({ method: r.request().method(), url: u, status: r.status() });
  });

  try {
    let seeded = false;

    while ((queue.length || !seeded) && states.length < MAX_STATES && actions < MAX_ACTIONS) {
      // The crawl has followed every link it can reach. Whatever prefix those
      // pages share is where the application actually lives - which is not
      // necessarily the origin it was given - so seeds are joined to that,
      // and only now, when there is evidence for what it is.
      if (!queue.length && !seeded) {
        seeded = true;
        const paths = states.filter((st) => (st.status ?? 200) < 400).map((st) => new URL(st.url).pathname);
        const mount = commonPrefix(paths);
        const origin = new URL(baseUrl).origin;
        for (const r of seedRoutes) {
          const url = `${origin}${mount}/${r.replace(/^\//, "")}`.replace(/([^:])\/\//g, "$1/");
          if (!seedUrls.has(url) && !states.some((st) => st.url === url)) {
            seedUrls.add(url);
            queue.push(url);
          }
        }
        if (!queue.length) break;
      }

      const target = queue.shift() as string;
      const started = Date.now();

      let status: number | null = null;
      try {
        const res = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15_000 });
        status = res?.status() ?? null;
      } catch {
        continue;
      }
      actions++;
      const elapsed = Date.now() - started;
      currentRoute = routeOf(page.url(), baseUrl);

      if (elapsed > SLOW_MS) {
        observations.push({
          kind: "slow-response",
          route: currentRoute,
          detail: `${elapsed}ms to first paint`,
          evidence: { ms: elapsed, url: target },
        });
      }

      const state = await readState(page, baseUrl, status);
      if (seen.has(state.signature)) continue;
      seen.add(state.signature);

      // A seed is a guess that a route exists. When the guess does not resolve
      // it has told us nothing about the application - the address was ours,
      // not the application's - so it is neither a state nor a finding. Only a
      // 4xx on a route the application itself linked to is worth reporting.
      const wasSeeded = seedUrls.has(target);
      if (status && status >= 400) {
        if (wasSeeded) continue;
        observations.push({
          kind: "http-status",
          route: state.route,
          detail: `HTTP ${status}`,
          evidence: { url: page.url(), status },
        });
      }

      states.push(state);

      // A page with no h1 has no accessible title for the screen a user landed
      // on. Recorded as an observation; whether it matters is decided later.
      const bodyText = await page.evaluate(`(document.body.innerText || "").slice(0, 300)`);
      if (!state.headings.length && String(bodyText).trim().length > 40) {
        observations.push({
          kind: "missing-heading",
          route: state.route,
          detail: "page renders content but has no h1 or h2",
          evidence: { url: page.url(), preview: String(bodyText).slice(0, 120) },
        });
      }

      // Inputs nothing names cannot be addressed by a person using a screen
      // reader, and cannot be addressed semantically by this agent either.
      const unlabelled = state.elements.filter((e) => e.role === "textbox" && !e.name);
      if (unlabelled.length) {
        observations.push({
          kind: "unlabelled-input",
          route: state.route,
          detail: `${unlabelled.length} input(s) with no accessible name`,
          evidence: { url: page.url(), count: unlabelled.length },
        });
      }

      // Queue links that stay inside the application.
      const links: string[] = await page.evaluate(`(() => Array.from(document.querySelectorAll("a[href]"))
        .map(a => a.href).filter(h => h.startsWith(${JSON.stringify(baseUrl)})))()`);
      for (const l of links) {
        const clean = l.split("#")[0];
        if (!queue.includes(clean) && !states.some((s) => s.url === clean)) queue.push(clean);
      }
    }
  } finally {
    await browser.close();
  }

  return {
    baseUrl,
    states,
    routes: [...new Set(states.map((s) => s.route))].sort(),
    apis,
    observations,
    actionsTaken: actions,
  };
}
