import "server-only";

import type { ChangeSignal } from "./code-change";

/**
 * Ranks existing tests by how much running them right now would tell you.
 *
 * Generating more tests is not the hard part; deciding which of the ones you
 * already have are worth the minutes is. The inputs are all things that
 * actually happened - failures this suite really produced and classified,
 * commits developers really made - rather than a static guess at importance.
 *
 * Every factor carries the sentence that justifies it. A single number is not
 * reviewable, and a ranking nobody can argue with is one nobody can trust.
 */

export type RankInput = {
  id: string;
  title: string;
  priority: string | null;
  /** Routes the spec navigates to, read out of its own code. */
  routes: string[];
  /** Verdicts this spec has received, newest first. */
  verdicts: Array<{ classification: string | null; at: Date | null }>;
};

export type Factor = { name: string; points: number; reason: string };

export type RankedTest = {
  id: string;
  title: string;
  score: number;
  factors: Factor[];
  headline: string;
};

/** Areas where a defect costs the most, independent of any history. */
const CRITICAL_AREA = /checkout|payment|pay\b|order|billing/i;
const SENSITIVE_AREA = /login|signup|sign-?in|auth|account|password|session/i;
const CORE_AREA = /^\/$|cart|product|search/i;
const PERIPHERAL_AREA = /settings|preferences|about|privacy|help/i;

const RECENT_DAYS = 7;
const WARM_DAYS = 30;

export function rankTests(
  cases: RankInput[],
  changes: Map<string, ChangeSignal>,
  routeToPath: (route: string) => string,
): RankedTest[] {
  const ranked = cases.map((c) => {
    const factors: Factor[] = [];
    const add = (name: string, points: number, reason: string) => factors.push({ name, points, reason });

    /* ---- What this test has actually caught ---- */
    const realBugs = c.verdicts.filter((v) => v.classification === "real-bug").length;
    const flakes = c.verdicts.filter((v) => v.classification === "flaky").length;
    const envs = c.verdicts.filter((v) => v.classification === "environment").length;

    if (realBugs > 0) {
      const points = Math.min(40, 18 + realBugs * 8);
      add(
        "has caught real bugs",
        points,
        `Classified as a real bug ${realBugs} ${realBugs === 1 ? "time" : "times"}. This area has a record of actually breaking, which is the strongest reason to spend minutes on it.`,
      );
    } else if (c.verdicts.length > 0) {
      add(
        "no real bugs recorded",
        0,
        `Has failed ${c.verdicts.length} ${c.verdicts.length === 1 ? "time" : "times"} but never in a way that was judged a genuine defect.`,
      );
    }

    if (envs > 0) {
      add(
        "outages discounted",
        0,
        `${envs} of its failures were environment outages. Those are not evidence about this test, so they are left out of the count above.`,
      );
    }

    if (flakes > 0 && flakes >= realBugs) {
      // A test that mostly fails at random tells you little when it fails.
      const penalty = -Math.min(15, flakes * 5);
      add(
        "mostly flaky",
        penalty,
        `Judged flaky ${flakes} ${flakes === 1 ? "time" : "times"}, at least as often as it found a real bug. A result that is unreliable either way buys less information per run.`,
      );
    }

    /* ---- What the developers have been touching ---- */
    const signals = c.routes.map((r) => changes.get(routeToPath(r))).filter(Boolean) as ChangeSignal[];
    const touched = signals.filter((s) => s.commits > 0);

    if (signals.length === 0) {
      add(
        "change history unavailable",
        0,
        "No commit history is available for the code behind this test, so recency could not be weighed. The score rests on its failure record and what it covers.",
      );
    } else if (touched.length === 0) {
      add(
        "untouched recently",
        0,
        "None of the code behind this test has changed in the last 90 days, so nothing new is likely to have broken here.",
      );
    } else {
      const freshest = touched.reduce((a, b) =>
        (a.lastChangedDaysAgo ?? 999) <= (b.lastChangedDaysAgo ?? 999) ? a : b,
      );
      const days = freshest.lastChangedDaysAgo ?? 999;

      if (days <= RECENT_DAYS) {
        add(
          "changed this week",
          30,
          `${freshest.path} changed ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}${freshest.lastSubject ? ` ("${freshest.lastSubject.slice(0, 60)}")` : ""}. Recently edited code is where regressions are.`,
        );
      } else if (days <= WARM_DAYS) {
        add(
          "changed this month",
          15,
          `${freshest.path} last changed ${days} days ago. Not fresh, but recent enough to be worth covering.`,
        );
      } else {
        add(
          "changed a while ago",
          5,
          `${freshest.path} last changed ${days} days ago, so it has had time to settle.`,
        );
      }

      const totalCommits = touched.reduce((n, s) => n + s.commits, 0);
      if (totalCommits >= 3) {
        add(
          "churns often",
          10,
          `${totalCommits} commits touched this area in the last 90 days. Code that keeps moving keeps breaking.`,
        );
      }
    }

    /* ---- What it costs when this particular thing is wrong ---- */
    const routeText = c.routes.join(" ") || c.title;
    if (CRITICAL_AREA.test(routeText)) {
      add(
        "money path",
        25,
        `Covers ${c.routes.join(", ") || "checkout"}. A defect here stops customers paying, so it is worth running even on a quiet week.`,
      );
    } else if (SENSITIVE_AREA.test(routeText)) {
      add(
        "access path",
        20,
        `Covers ${c.routes.join(", ")}. Sign-in and account defects lock people out or let the wrong people in.`,
      );
    } else if (CORE_AREA.test(routeText)) {
      add(
        "core journey",
        12,
        `Covers ${c.routes.join(", ") || "the main journey"}, which most sessions pass through.`,
      );
    } else if (PERIPHERAL_AREA.test(routeText)) {
      add(
        "peripheral",
        3,
        `Covers ${c.routes.join(", ")}, which few sessions reach and which fails cheaply.`,
      );
    }

    const score = Math.max(0, Math.min(100, factors.reduce((n, f) => n + f.points, 0)));
    const strongest = [...factors].sort((a, b) => b.points - a.points)[0];

    return {
      id: c.id,
      title: c.title,
      score,
      factors,
      headline: strongest && strongest.points > 0 ? strongest.reason : "Nothing marks this out as urgent.",
    };
  });

  return ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/** Routes a spec navigates to, read out of the spec itself. */
export function routesFromSpec(code: string | null): string[] {
  if (!code) return [];
  const found = new Set<string>();

  // Matches the SHOP + "/checkout" shape these specs use, and plain literals.
  for (const m of code.matchAll(/["'`](\/[a-zA-Z0-9\-_/[\]:.]*)["'`]/g)) {
    const route = m[1];
    if (route.startsWith("/api/") || /\.(css|js|png|svg)$/.test(route)) continue;
    found.add(route === "" ? "/" : route);
  }
  return [...found];
}
