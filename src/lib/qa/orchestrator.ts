import "server-only";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { exploreApplication, type ApplicationModel } from "./explore";
import { probeApplication, probeApis } from "./probe";
import { deriveFindings, resetFindingIds, type Finding } from "./findings";
import { assessStability, type StabilityReport } from "./flaky";
import { selectByImpact, type Selection } from "./impact";

/**
 * One autonomous QA pass over a running application.
 *
 * The order matters and is not arbitrary. Discovery has to precede probing
 * because a probe needs somewhere to aim; probing has to precede judgement
 * because a finding without an observation behind it is an opinion; and
 * stability has to run last because it is the only stage that costs minutes
 * rather than seconds.
 *
 * Every stage is optional and every stage is recorded, including the ones that
 * found nothing. A report that only lists what went wrong cannot be
 * distinguished from a report where a stage silently failed to run.
 */

export type QaStage = {
  name: string;
  status: "ok" | "skipped" | "failed";
  ms: number;
  summary: string;
};

export type QaReport = {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  stages: QaStage[];
  model: {
    routes: string[];
    states: number;
    interactiveElements: number;
    apis: Array<{ method: string; url: string; status: number }>;
    actionsTaken: number;
  };
  findings: Finding[];
  stability: StabilityReport[];
  selection: Selection | null;
  /** Findings the existing suite would already have caught. */
  coverageGap: Array<{ id: string; title: string; coveredByExistingTests: boolean }>;
};

async function timed<T>(name: string, stages: QaStage[], fn: () => Promise<T>, summarise: (r: T) => string): Promise<T | null> {
  const t = Date.now();
  try {
    const result = await fn();
    stages.push({ name, status: "ok", ms: Date.now() - t, summary: summarise(result) });
    return result;
  } catch (err) {
    stages.push({
      name,
      status: "failed",
      ms: Date.now() - t,
      summary: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    });
    return null;
  }
}

/**
 * Whether the existing suite already covers a finding's route.
 *
 * This is the number that says whether autonomous exploration earned its
 * place: a finding on a route no spec touches is one the suite could not have
 * produced however many times it was run.
 */
async function coverageFor(projectId: string, findings: Finding[]) {
  const db = getDb();
  const cases = await db
    .select({ code: schema.testCases.playwrightCode })
    .from(schema.testCases)
    .innerJoin(schema.testSuites, eq(schema.testCases.suiteId, schema.testSuites.id))
    .where(eq(schema.testSuites.projectId, projectId));

  const covered = new Set<string>();
  for (const c of cases) {
    if (!c.code) continue;
    for (const m of c.code.matchAll(/["'`](\/[a-zA-Z0-9\-_/[\]:.]*)["'`]/g)) covered.add(m[1]);
  }

  return findings.map((f) => ({
    id: f.id,
    title: f.title,
    coveredByExistingTests: [...covered].some((r) => r !== "/" && f.route.includes(r)),
  }));
}

export async function runAutonomousQa(opts: {
  projectId: string;
  baseUrl: string;
  repoRoot: string;
  /** Stability costs a suite run per iteration, so it is opt-in. */
  stabilityRuns?: number;
  since?: string;
}): Promise<QaReport> {
  resetFindingIds();
  const stages: QaStage[] = [];
  const startedAt = new Date().toISOString();

  // Routes already discovered from the source aim the walk at states nothing
  // links to. The crawl still decides what it finds once it gets there.
  const db0 = getDb();
  const seeds = (
    await db0
      .select({ path: schema.discoveredPages.path })
      .from(schema.discoveredPages)
      .where(eq(schema.discoveredPages.projectId, opts.projectId))
  ).map((r) => r.path);

  const model = await timed(
    "discovery",
    stages,
    () => exploreApplication(opts.baseUrl, seeds),
    (m: ApplicationModel) =>
      `${m.states.length} states, ${m.routes.length} routes, ${m.apis.length} API calls, ${m.actionsTaken} actions`,
  );

  const empty: ApplicationModel = {
    baseUrl: opts.baseUrl,
    states: [],
    routes: [],
    apis: [],
    observations: [],
    actionsTaken: 0,
  };
  const appModel = model ?? empty;

  const uiProbes = await timed(
    "probing (ui)",
    stages,
    () => probeApplication(appModel),
    (r) => `${r.observations.length} observation(s), ${new Set(r.apis.map((a) => a.url)).size} API endpoint(s) surfaced`,
  );

  // Submitting forms is what reveals an application's own API. Anything the
  // probes triggered joins what the crawl saw before the endpoints are called
  // directly.
  const withApis: ApplicationModel = {
    ...appModel,
    apis: [...appModel.apis, ...(uiProbes?.apis ?? [])],
  };

  const apiProbes = await timed(
    "probing (api)",
    stages,
    () => probeApis(withApis),
    (o) => `${o.length} observation(s) from ${new Set(withApis.apis.map((a) => a.url)).size} endpoint(s)`,
  );

  const findings = deriveFindings(withApis, [...(uiProbes?.observations ?? []), ...(apiProbes ?? [])]);
  stages.push({
    name: "judgement",
    status: "ok",
    ms: 0,
    summary: `${findings.length} finding(s) from ${withApis.observations.length + (uiProbes?.observations.length ?? 0) + (apiProbes?.length ?? 0)} observation(s)`,
  });

  const selection = await timed(
    "regression selection",
    stages,
    () => selectByImpact(opts.projectId, opts.repoRoot, { since: opts.since }),
    (s: Selection) =>
      s.mode === "full"
        ? `full suite (${s.selected.length}) - ${s.fallbackReason}`
        : `${s.selected.length} selected, ${s.skipped.length} skipped from ${s.changedRoutes.length} changed route(s)`,
  );

  let stability: StabilityReport[] = [];
  if (opts.stabilityRuns && opts.stabilityRuns > 0) {
    stability =
      (await timed(
        "stability",
        stages,
        () => assessStability(opts.projectId, { runs: opts.stabilityRuns }),
        (r: StabilityReport[]) => {
          const flaky = r.filter((x) => x.stability === "FLAKY").length;
          return `${r.length} spec(s) over ${opts.stabilityRuns} runs, ${flaky} flaky`;
        },
      )) ?? [];
  } else {
    stages.push({ name: "stability", status: "skipped", ms: 0, summary: "not requested" });
  }

  const coverageGap = await coverageFor(opts.projectId, findings);

  return {
    baseUrl: opts.baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    stages,
    model: {
      routes: withApis.routes,
      states: withApis.states.length,
      interactiveElements: withApis.states.reduce((n, s) => n + s.elements.length, 0),
      apis: withApis.apis,
      actionsTaken: withApis.actionsTaken,
    },
    findings,
    stability,
    selection,
    coverageGap,
  };
}
