import "server-only";

/**
 * Turns discovered routes into Playwright specs.
 *
 * This is deliberately mechanical rather than clever. Every assertion is
 * something that is true of any working page - the route exists and was served,
 * it rendered a body, and a form that the source declares is present.
 * Nothing here guesses at business rules, because nothing here has read them.
 * A generated spec is a starting point a human edits, not a finished test.
 */

export type RouteInput = {
  path: string;
  title: string;
  forms: number;
  gated: boolean;
  risk: string | null;
  /** Markup of the file this route renders from, when it was stored. */
  source?: string | null;
  sourceFile?: string | null;
};

/** Something the source declares, which a spec can therefore check for. */
type Landmark = { assertion: string; step: string };

/** Strips template syntax so only literal text is used. */
function literal(text: string): string | null {
  const cleaned = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\{\{[^}]*\}\}|\{[^}]*\}|@[A-Za-z.()]+|<%=?[^%]*%>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 60) return null;
  // Anything still holding a placeholder is not a literal.
  if (/[{}<>@%]/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Reads the markup for things a working page must show.
 *
 * Only literal text is used. A heading built from a variable is real on the
 * page but unknowable from here, so it is skipped rather than guessed at.
 */
function landmarksFrom(source: string): Landmark[] {
  const found: Landmark[] = [];
  const seen = new Set<string>();
  const add = (l: Landmark) => {
    if (seen.has(l.assertion)) return;
    seen.add(l.assertion);
    found.push(l);
  };

  // Page title.
  const title = literal(source.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "");
  if (title) {
    add({
      assertion: `  await expect(page).toHaveTitle(${JSON.stringify(title)});`,
      step: `Check the page title is "${title}"`,
    });
  }

  // Headings, which are the clearest sign the right page rendered.
  for (const m of source.matchAll(/<h([1-3])[^>]*>([\s\S]{1,120}?)<\/h\1>/gi)) {
    const text = literal(m[2]);
    if (!text) continue;
    add({
      assertion: `  await expect(page.getByRole("heading", { name: ${JSON.stringify(text)} })).toBeVisible();`,
      step: `Check the heading "${text}" is shown`,
    });
    if (found.length > 6) break;
  }

  // Named form fields, which is what a form is for.
  for (const m of source.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
    const attrs = m[2];
    if (/type\s*=\s*["'](hidden|submit|button)["']/i.test(attrs)) continue;
    const id = attrs.match(/\bid\s*=\s*["']([^"'{}@]+)["']/)?.[1];
    const name = attrs.match(/\bname\s*=\s*["']([^"'{}@]+)["']/)?.[1];
    const placeholder = literal(attrs.match(/\bplaceholder\s*=\s*["']([^"']+)["']/)?.[1] ?? "");
    if (id) {
      add({
        assertion: `  await expect(page.locator(${JSON.stringify(`#${id}`)})).toBeVisible();`,
        step: `Check the field #${id} is present`,
      });
    } else if (placeholder) {
      add({
        assertion: `  await expect(page.getByPlaceholder(${JSON.stringify(placeholder)})).toBeVisible();`,
        step: `Check the field placeholdered "${placeholder}" is present`,
      });
    } else if (name) {
      add({
        assertion: `  await expect(page.locator(${JSON.stringify(`[name="${name}"]`)})).toBeVisible();`,
        step: `Check the field named ${name} is present`,
      });
    }
    if (found.length > 10) break;
  }

  // Buttons and submits, which are the actions the page offers.
  for (const m of source.matchAll(/<button[^>]*>([\s\S]{1,60}?)<\/button>/gi)) {
    const text = literal(m[1]);
    if (!text) continue;
    add({
      assertion: `  await expect(page.getByRole("button", { name: ${JSON.stringify(text)} })).toBeVisible();`,
      step: `Check the "${text}" button is present`,
    });
    if (found.length > 12) break;
  }
  for (const m of source.matchAll(/<input[^>]*type\s*=\s*["']submit["'][^>]*value\s*=\s*["']([^"']+)["']/gi)) {
    const text = literal(m[1]);
    if (!text) continue;
    add({
      assertion: `  await expect(page.getByRole("button", { name: ${JSON.stringify(text)} })).toBeVisible();`,
      step: `Check the "${text}" button is present`,
    });
  }

  return found.slice(0, 8);
}

export type GeneratedCase = {
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  priority: "critical" | "high" | "medium" | "low";
  filePathHint: string;
  code: string;
};

/** A route reduced to something usable as an identifier. */
function slug(routePath: string): string {
  const cleaned = routePath
    .replace(/[[\]{}:]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return cleaned || "home";
}

/**
 * A dynamic segment has no value we can know, so it is filled with something
 * obviously placeholder. The spec is marked so nobody mistakes it for passing
 * against real data.
 */
function concreteUrl(routePath: string): { url: string; hasPlaceholder: boolean } {
  const hasPlaceholder = /\[|:/.test(routePath);
  const filled = routePath
    .replace(/\[\.{3}([^\]]+)\]/g, "placeholder")
    .replace(/\[([^\]]+)\]/g, "placeholder")
    .replace(/:([A-Za-z0-9_]+)/g, "placeholder");

  // Directory names can contain spaces and other characters that are not legal
  // in a URL. Each segment is encoded so the spec navigates somewhere valid;
  // without this a folder like "blog website" produced a broken address.
  const url =
    "/" +
    filled
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

  return { url, hasPlaceholder };
}

function priorityFor(route: RouteInput): GeneratedCase["priority"] {
  if (route.risk === "critical") return "critical";
  if (route.risk === "high" || route.gated) return "high";
  if (route.path === "/") return "high";
  return route.risk === "medium" ? "medium" : "low";
}

export function generateSpecsForRoutes(routes: RouteInput[], baseUrl: string): GeneratedCase[] {
  const base = baseUrl.replace(/\/+$/, "");

  return routes.map((route) => {
    const { url, hasPlaceholder } = concreteUrl(route.path);
    const name = slug(route.path);
    const target = `${base}${url === "/" ? "/" : url}`;

    const notes = [
      hasPlaceholder
        ? "// This route has a dynamic segment. \"placeholder\" stands in for a real\n// id, so replace it with a value that exists before trusting this spec."
        : null,
      route.gated
        ? "// This route looks gated. Without a signed-in session it may redirect to\n// a sign-in page, which Playwright follows - so this checks the app served\n// something, not that the gated page itself was reached."
        : null,
    ].filter(Boolean);

    // A gated route may render a sign-in page instead, so its own markup is
    // not what a signed-out run would see. Checking for it would fail for the
    // wrong reason.
    const landmarks = route.gated || !route.source ? [] : landmarksFrom(route.source);

    const body = [
      `  const response = await page.goto(${JSON.stringify(target)});`,
      "",
      "  // Redirects are followed before this is read, so a gated route that",
      "  // bounces to a sign-in page still reports the page it landed on.",
      "  // Below 400 means the route exists and was served: a 404 here says the",
      "  // base URL does not host this route, which is a real failure rather",
      "  // than something to wave through.",
      "  expect(response?.status() ?? 0).toBeLessThan(400);",
      "  await expect(page.locator('body')).toBeVisible();",
      route.forms > 0 && !route.gated
        ? "\n  // The source declares a form on this route.\n  await expect(page.locator('form').first()).toBeVisible();"
        : "",
      landmarks.length
        ? `\n  // Read from ${route.sourceFile ?? "the source"}: these are declared in the\n  // markup this route renders, so a working page has to show them.\n${landmarks.map((l) => l.assertion).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const code = `import { test, expect } from "@playwright/test";

// Generated by Parikshan from the route ${route.path} found in the repository.
${notes.length ? notes.join("\n") + "\n" : ""}
test(${JSON.stringify(`${route.title || route.path} loads`)}, async ({ page }) => {
${body}
});
`;

    return {
      title: `${route.title || route.path} loads`,
      description: `Opens ${route.path} and checks the application responds and renders.`,
      steps: [
        `Navigate to ${route.path}`,
        "Check the route was served, following any redirect",
        "Check the page renders a body",
        ...(route.forms > 0 && !route.gated ? ["Check the form declared in the source is present"] : []),
        ...landmarks.map((l) => l.step),
      ],
      expectedResult: landmarks.length
        ? `The route is served and shows the ${landmarks.length} element${landmarks.length === 1 ? "" : "s"} its source declares.`
        : "The route exists at the base URL, is served without an error, and renders.",
      priority: priorityFor(route),
      filePathHint: `tests/parikshan/${name}.spec.ts`,
      code,
    };
  });
}
