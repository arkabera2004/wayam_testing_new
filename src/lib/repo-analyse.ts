import "server-only";

import type { ImportedFile } from "./repo-import";

/**
 * Derives routes and API endpoints from the file tree of an imported
 * repository. This is static analysis of paths and, where the file was small
 * enough to store, its contents - not a crawl and not a model call. Everything
 * here is something the repository literally states.
 */

export type DerivedPage = { path: string; title: string; forms: number; apis: number; gated: boolean; risk: string };
export type DerivedEndpoint = { method: string; path: string };

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/**
 * "src/app/(marketing)/about/page.tsx" -> "/about"
 *
 * The "app" directory is matched at any depth, not just the repository root.
 * Monorepos and example repositories keep whole applications in
 * subdirectories, and anchoring at the root found nothing in them.
 */
function routeFromAppPath(file: string): string | null {
  const m = file.match(/(?:^|\/)app\/(.*)\/(page|route)\.(tsx?|jsx?)$/);
  if (!m) return null;
  const segments = m[1]
    .split("/")
    .filter(Boolean)
    // Route groups "(marketing)" and parallel slots "@modal" are not in the URL.
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"));
  return "/" + segments.join("/");
}

/** "src/pages/blog/[slug].tsx" -> "/blog/[slug]". Also matched at any depth. */
function routeFromPagesPath(file: string): string | null {
  const m = file.match(/(?:^|\/)pages\/(.*)\.(tsx?|jsx?)$/);
  if (!m) return null;
  if (/^_(app|document|error)$/.test(m[1])) return null;
  const cleaned = m[1].replace(/\/index$/, "").replace(/^index$/, "");
  return "/" + cleaned;
}

function titleFor(route: string): string {
  if (route === "/") return "Home";
  const last = route.split("/").filter(Boolean).pop() ?? "";
  const words = last.replace(/^\[\.{0,3}(.+)\]$/, "$1").replace(/[-_]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Auth-ish segments are a strong hint the route sits behind a wall. */
function looksGated(route: string, content: string | null): boolean {
  if (/\b(dashboard|account|admin|settings|billing|profile)\b/i.test(route)) return true;
  return Boolean(content && /getServerSession|requireAuth|withAuth|redirect\(["']\/login/.test(content));
}

function riskFor(route: string, forms: number, gated: boolean): string {
  if (/\b(checkout|payment|pay|billing|order)\b/i.test(route)) return "critical";
  if (forms > 0 || gated) return "high";
  if (route === "/" || /\b(search|products?|cart)\b/i.test(route)) return "medium";
  return "low";
}

export function analyseRepo(files: ImportedFile[]): {
  pages: DerivedPage[];
  endpoints: DerivedEndpoint[];
} {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const pages: DerivedPage[] = [];
  const endpoints: DerivedEndpoint[] = [];

  for (const file of files) {
    // API route handlers: "app/api/users/route.ts" -> the methods it exports.
    if (/(?:^|\/)app\/.*\/route\.(tsx?|jsx?)$/.test(file.path)) {
      const route = routeFromAppPath(file.path);
      if (route) {
        const content = byPath.get(file.path)?.content ?? "";
        const found = HTTP_METHODS.filter((m) =>
          new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(content),
        );
        // With no readable content the route still exists; GET is the honest
        // minimum rather than inventing a verb list.
        for (const method of found.length ? found : ["GET"]) endpoints.push({ method, path: route });
      }
      continue;
    }

    if (/(?:^|\/)pages\/api\/.*\.(tsx?|jsx?)$/.test(file.path)) {
      const route = routeFromPagesPath(file.path);
      if (route) endpoints.push({ method: "GET", path: route });
      continue;
    }

    const route = routeFromAppPath(file.path) ?? routeFromPagesPath(file.path);
    if (!route) continue;

    const content = byPath.get(file.path)?.content ?? null;
    const forms = content ? (content.match(/<form\b/gi) ?? []).length : 0;
    const apis = content ? (content.match(/fetch\(|useSWR\(|useQuery\(/g) ?? []).length : 0;
    const gated = looksGated(route, content);

    pages.push({ path: route, title: titleFor(route), forms, apis, gated, risk: riskFor(route, forms, gated) });
  }

  // A repository can define the same route twice (page and layout variants).
  const seenPage = new Set<string>();
  const seenEndpoint = new Set<string>();
  return {
    pages: pages.filter((p) => !seenPage.has(p.path) && seenPage.add(p.path)),
    endpoints: endpoints.filter((e) => {
      const key = `${e.method} ${e.path}`;
      return !seenEndpoint.has(key) && seenEndpoint.add(key);
    }),
  };
}
