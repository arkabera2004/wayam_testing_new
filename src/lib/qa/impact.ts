import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { childEnv } from "@/lib/child-env";
import { shopstackPathForRoute } from "@/lib/code-change";
import { routesFromSpec } from "@/lib/risk-ranker";

const run = promisify(execFile);

/**
 * Choosing which tests a change actually requires.
 *
 * Running everything is always correct and often wasteful; running a guess is
 * fast and sometimes wrong in the one way that matters. This picks by tracing
 * what changed to what exercises it, and - more importantly - explains both
 * halves of the decision, including what it skipped and what that costs. A
 * selection nobody can audit is a selection nobody should trust.
 *
 * The mapping runs in the same direction as the risk ranker's: a spec names
 * routes, and a route maps to the files that serve it. Sharing
 * `routesFromSpec` with the ranker is deliberate, so the two screens cannot
 * disagree about what a spec touches.
 */

export type Selection = {
  changedFiles: string[];
  changedRoutes: string[];
  selected: Array<{ id: string; title: string; reason: string }>;
  skipped: Array<{ id: string; title: string; reason: string; risk: "low" | "medium" }>;
  mode: "impact" | "full";
  /** Why the whole suite was taken instead of a subset. */
  fallbackReason: string | null;
};

/** Files changed against a ref. Uncommitted work counts: it is what will run. */
async function changedFiles(repoRoot: string, since: string): Promise<string[]> {
  const out = new Set<string>();
  for (const args of [
    ["diff", "--name-only", since],
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
  ]) {
    try {
      const { stdout } = await run("git", args, { cwd: repoRoot, timeout: 20_000, env: childEnv() });
      stdout.split("\n").map((s) => s.trim()).filter(Boolean).forEach((f) => out.add(f));
    } catch {
      /* A ref that does not resolve is not fatal; the other two still apply. */
    }
  }
  return [...out];
}

/**
 * Which routes a changed file serves.
 *
 * Derived by asking the same question in reverse: for every route a spec
 * mentions, which file backs it. A file that backs no route - a shared
 * utility, a config - cannot be attributed this way, and that is the case the
 * caller has to be told about rather than have silently dropped.
 */
function routesForFile(file: string, knownRoutes: string[]): string[] {
  return knownRoutes.filter((route) => {
    const backing = shopstackPathForRoute(route);
    return Boolean(backing) && file.includes(backing);
  });
}

export async function selectByImpact(
  projectId: string,
  repoRoot: string,
  opts?: { since?: string },
): Promise<Selection> {
  const db = getDb();
  const since = opts?.since ?? "HEAD";

  const cases = await db
    .select({ id: schema.testCases.id, title: schema.testCases.title, code: schema.testCases.playwrightCode })
    .from(schema.testCases)
    .innerJoin(schema.testSuites, eq(schema.testCases.suiteId, schema.testSuites.id))
    .where(eq(schema.testSuites.projectId, projectId));

  const runnable = cases.filter((c) => c.code?.trim());
  const specRoutes = new Map(runnable.map((c) => [c.id, routesFromSpec(c.code)] as const));
  const knownRoutes = [...new Set([...specRoutes.values()].flat())];

  const files = await changedFiles(repoRoot, since);

  // Nothing changed: there is no impact to reason from, so asking for an
  // impact-based subset is a question with no answer. Say so rather than
  // return an empty selection that reads like "no tests needed".
  if (files.length === 0) {
    return {
      changedFiles: [],
      changedRoutes: [],
      selected: runnable.map((c) => ({ id: c.id, title: c.title, reason: "No changes detected, so nothing could be excluded on impact." })),
      skipped: [],
      mode: "full",
      fallbackReason: "No changed files against " + since,
    };
  }

  const changedRoutes = [...new Set(files.flatMap((f) => routesForFile(f, knownRoutes)))];

  // Files that changed but map to no route: shared code, config, the harness
  // itself. Their blast radius is unknown, and unknown is not the same as
  // none, so the honest response is the whole suite.
  const unattributable = files.filter(
    (f) => routesForFile(f, knownRoutes).length === 0 && /\.(tsx?|jsx?|mjs|cjs)$/.test(f),
  );

  if (changedRoutes.length === 0 || unattributable.length > 0) {
    return {
      changedFiles: files,
      changedRoutes,
      selected: runnable.map((c) => ({
        id: c.id,
        title: c.title,
        reason:
          changedRoutes.length === 0
            ? "No changed file maps to a route any spec exercises, so impact cannot be bounded."
            : `${unattributable.length} changed file(s) back no specific route, so their blast radius is unknown.`,
      })),
      skipped: [],
      mode: "full",
      fallbackReason:
        changedRoutes.length === 0
          ? "Changes could not be attributed to any route"
          : `Unattributable changes: ${unattributable.slice(0, 5).join(", ")}`,
    };
  }

  const selected: Selection["selected"] = [];
  const skipped: Selection["skipped"] = [];

  for (const c of runnable) {
    const routes = specRoutes.get(c.id) ?? [];
    const hit = routes.filter((r) => changedRoutes.includes(r));
    if (hit.length) {
      selected.push({ id: c.id, title: c.title, reason: `Exercises ${hit.join(", ")}, which the change touches.` });
    } else {
      skipped.push({
        id: c.id,
        title: c.title,
        reason: `Exercises ${routes.length ? routes.join(", ") : "no route this can attribute"}; none of it changed.`,
        // A spec whose routes are known and untouched is a safer skip than one
        // whose routes could not be read at all.
        risk: routes.length ? "low" : "medium",
      });
    }
  }

  return { changedFiles: files, changedRoutes, selected, skipped, mode: "impact", fallbackReason: null };
}
