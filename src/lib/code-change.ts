import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * How recently, and how often, the code behind a route changed.
 *
 * Read from the repository's own history rather than from anything this app
 * records, so it reflects what developers actually did. Only works where the
 * code is checked out here - an imported repository is a file listing with no
 * history attached, and for those this returns nothing rather than a guess.
 * A missing change signal has to leave the ranking standing on its other
 * factors, not silently score as zero risk.
 */

export type ChangeSignal = {
  path: string;
  commits: number;
  lastChangedDaysAgo: number | null;
  lastSubject: string | null;
};

const WINDOW_DAYS = 90;

export async function changeSignalsForPaths(
  repoRoot: string,
  paths: string[],
): Promise<Map<string, ChangeSignal>> {
  const out = new Map<string, ChangeSignal>();

  await Promise.all(
    [...new Set(paths)].map(async (p) => {
      try {
        const { stdout } = await run(
          "git",
          ["log", `--since=${WINDOW_DAYS} days ago`, "--format=%ct%x09%s", "--", p],
          { cwd: repoRoot, timeout: 10_000 },
        );
        const lines = stdout.split("\n").filter(Boolean);
        if (lines.length === 0) {
          out.set(p, { path: p, commits: 0, lastChangedDaysAgo: null, lastSubject: null });
          return;
        }
        const [ts, subject] = lines[0].split("\t");
        const days = Math.floor((Date.now() / 1000 - Number(ts)) / 86_400);
        out.set(p, {
          path: p,
          commits: lines.length,
          lastChangedDaysAgo: days,
          lastSubject: subject ?? null,
        });
      } catch {
        // Not a repository, or the path is untracked. Absent, not zero.
      }
    }),
  );

  return out;
}

/** Where the storefront's code lives, for mapping a route to a directory. */
export function shopstackPathForRoute(route: string): string {
  const clean = route.replace(/^\/+|\/+$/g, "");
  return path.posix.join("apps/shopstack/src/app", clean);
}
