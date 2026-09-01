import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

/** Server-side copy of the relative-time format, so both sides agree. */
function relativeLabel(value: Date | null): string {
  if (!value) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

import { getDb, schema } from "./index";

/**
 * Data access for the projects → suites → cases → runs → results spine.
 *
 * Every read is scoped by `userId` (a Clerk subject) at the projects table and
 * joined downward, so a caller cannot reach another tenant's rows by guessing a
 * uuid. Keep that property when adding queries here.
 */

export async function listProjects(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .orderBy(desc(schema.projects.updatedAt));
}

/**
 * URL slug for a project. The table has no slug column, so it is derived from
 * the name — "ShopStack" ↔ /projects/shopstack. Keeps the existing routes
 * working without a migration.
 */
export function projectSlug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves either a uuid or a slug. Slugs are matched in the application
 * rather than SQL so the derivation stays in one place.
 */
export async function resolveProject(userId: string, idOrSlug: string) {
  if (UUID.test(idOrSlug)) return getProject(userId, idOrSlug);
  const all = await listProjects(userId);
  return all.find((p) => projectSlug(p.name) === idOrSlug.toLowerCase()) ?? null;
}

export async function getProject(userId: string, projectId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createProject(input: {
  userId: string;
  name: string;
  description?: string;
  githubRepoUrl?: string;
  githubDefaultBranch?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(schema.projects).values(input).returning();
  return row;
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<{ name: string; description: string; githubRepoUrl: string; githubDefaultBranch: string }>,
) {
  const db = getDb();
  const [row] = await db
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteProject(userId: string, projectId: string) {
  const db = getDb();
  const rows = await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .returning({ id: schema.projects.id });
  return rows.length > 0;
}

/** Suite ids the user owns — the guard every downward query funnels through. */
async function ownedSuiteIds(userId: string, projectId?: string) {
  const db = getDb();
  const rows = await db
    .select({ id: schema.testSuites.id })
    .from(schema.testSuites)
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(
      projectId
        ? and(eq(schema.projects.userId, userId), eq(schema.projects.id, projectId))
        : eq(schema.projects.userId, userId),
    );
  return rows.map((r) => r.id);
}

export async function listSuites(userId: string, projectId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.testSuites)
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.id, projectId)))
    .then((rows) => rows.map((r) => r.test_suites));
}

export async function listTestCases(userId: string, projectId: string) {
  const ids = await ownedSuiteIds(userId, projectId);
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.testCases)
    .where(inArray(schema.testCases.suiteId, ids))
    .orderBy(desc(schema.testCases.createdAt));
}

export async function listRuns(userId: string, projectId: string, limit = 20) {
  const ids = await ownedSuiteIds(userId, projectId);
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.testRuns)
    .where(inArray(schema.testRuns.suiteId, ids))
    .orderBy(desc(schema.testRuns.startedAt))
    .limit(limit);
}

export async function getRunWithResults(userId: string, runId: string) {
  const db = getDb();
  const [run] = await db
    .select({ run: schema.testRuns })
    .from(schema.testRuns)
    .innerJoin(schema.testSuites, eq(schema.testRuns.suiteId, schema.testSuites.id))
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(and(eq(schema.testRuns.id, runId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!run) return null;

  const results = await db
    .select({ result: schema.testRunResults, testCase: schema.testCases })
    .from(schema.testRunResults)
    .innerJoin(schema.testCases, eq(schema.testRunResults.testCaseId, schema.testCases.id))
    .where(eq(schema.testRunResults.runId, runId));

  return { run: run.run, results };
}

/** Headline numbers for the overview. */
export async function projectStats(userId: string, projectId: string) {
  const ids = await ownedSuiteIds(userId, projectId);
  if (ids.length === 0) return { tests: 0, runs: 0, passRate: 0 };
  const db = getDb();

  // Counted with Drizzle's own operators rather than interpolating the id list
  // into raw SQL: the template expands a JS array to a comma-separated tuple,
  // which `= any(...)` rejects.
  const [[tests], [runs], [passed]] = await Promise.all([
    db.select({ n: count() }).from(schema.testCases).where(inArray(schema.testCases.suiteId, ids)),
    db.select({ n: count() }).from(schema.testRuns).where(inArray(schema.testRuns.suiteId, ids)),
    db
      .select({ n: count() })
      .from(schema.testRuns)
      .where(and(inArray(schema.testRuns.suiteId, ids), eq(schema.testRuns.status, "passed"))),
  ]);

  const passRate = runs.n > 0 ? Math.round((passed.n / runs.n) * 1000) / 10 : 0;
  return { tests: tests.n, runs: runs.n, passRate };
}

/**
 * Everything the projects table renders, assembled server-side.
 *
 * The table shows a test count and a last-run summary that no single row
 * carries, so they are derived here rather than in the component. Coverage has
 * no table yet and is returned as null so the UI can say so honestly instead of
 * printing a zero that looks like real measurement.
 */
export type ProjectSummary = Awaited<ReturnType<typeof listProjectsWithStats>>[number];

export async function listProjectsWithStats(userId: string) {
  const db = getDb();
  const projects = await listProjects(userId);
  if (projects.length === 0) return [];

  const suites = await db
    .select({ id: schema.testSuites.id, projectId: schema.testSuites.projectId })
    .from(schema.testSuites)
    .where(
      inArray(
        schema.testSuites.projectId,
        projects.map((p) => p.id),
      ),
    );

  const suiteIds = suites.map((s) => s.id);
  const projectOfSuite = new Map(suites.map((s) => [s.id, s.projectId]));

  const [cases, runs] = suiteIds.length
    ? await Promise.all([
        db
          .select({ id: schema.testCases.id, suiteId: schema.testCases.suiteId })
          .from(schema.testCases)
          .where(inArray(schema.testCases.suiteId, suiteIds)),
        db
          .select({
            suiteId: schema.testRuns.suiteId,
            status: schema.testRuns.status,
            startedAt: schema.testRuns.startedAt,
          })
          .from(schema.testRuns)
          .where(inArray(schema.testRuns.suiteId, suiteIds))
          .orderBy(desc(schema.testRuns.startedAt)),
      ])
    : [[], []];

  return projects.map((p) => {
    const mine = new Set(suites.filter((s) => s.projectId === p.id).map((s) => s.id));
    const tests = cases.filter((c) => mine.has(c.suiteId)).length;
    const latest = runs.find((r) => projectOfSuite.get(r.suiteId) === p.id) ?? null;
    return {
      ...p,
      slug: projectSlug(p.name),
      tests,
      lastRunStatus: latest?.status ?? null,
      lastRunAt: latest?.startedAt ?? null,
      coverage: null as number | null,
    };
  });
}

/**
 * Runs with their per-result tallies, for the runs table.
 *
 * The counts and duration live in test_run_results, so they are aggregated
 * here in one extra query rather than N. `finishedAt` is nullable and has no
 * database default, so duration falls back to the summed result durations.
 */
export async function listRunsWithCounts(userId: string, projectId: string, limit = 20) {
  const ids = await ownedSuiteIds(userId, projectId);
  if (ids.length === 0) return [];
  const db = getDb();

  const runs = await db
    .select()
    .from(schema.testRuns)
    .where(inArray(schema.testRuns.suiteId, ids))
    .orderBy(desc(schema.testRuns.startedAt))
    .limit(limit);
  if (runs.length === 0) return [];

  const results = await db
    .select({
      runId: schema.testRunResults.runId,
      status: schema.testRunResults.status,
      durationMs: schema.testRunResults.durationMs,
    })
    .from(schema.testRunResults)
    .where(
      inArray(
        schema.testRunResults.runId,
        runs.map((r) => r.id),
      ),
    );

  return runs.map((run) => {
    const mine = results.filter((r) => r.runId === run.id);
    const durationMs =
      run.finishedAt && run.startedAt
        ? run.finishedAt.getTime() - run.startedAt.getTime()
        : mine.reduce((n, r) => n + (r.durationMs ?? 0), 0);
    return {
      ...run,
      passed: mine.filter((r) => r.status === "pass").length,
      failed: mine.filter((r) => r.status === "fail" || r.status === "error").length,
      skipped: mine.filter((r) => r.status === "skipped").length,
      total: mine.length,
      durationMs,
    };
  });
}

/**
 * Workspace totals for the projects screen.
 *
 * These four cards previously showed fixed demo numbers — "Total projects 3"
 * sat above a table listing seven — so they are computed from the same rows
 * the table renders. Pass rate is measured per result rather than per run,
 * which is the honest denominator when a run can be partially green.
 */
export type WorkspaceStats = Awaited<ReturnType<typeof workspaceStats>>;

export async function workspaceStats(userId: string) {
  const db = getDb();
  const projects = await listProjects(userId);
  if (projects.length === 0) {
    return { projects: 0, tests: 0, passRate: null as number | null, testMs: 0, runs: 0 };
  }

  const suites = await db
    .select({ id: schema.testSuites.id })
    .from(schema.testSuites)
    .where(inArray(schema.testSuites.projectId, projects.map((p) => p.id)));
  const suiteIds = suites.map((s) => s.id);

  if (suiteIds.length === 0) {
    return { projects: projects.length, tests: 0, passRate: null, testMs: 0, runs: 0 };
  }

  const [[tests], runs] = await Promise.all([
    db.select({ n: count() }).from(schema.testCases).where(inArray(schema.testCases.suiteId, suiteIds)),
    db.select({ id: schema.testRuns.id }).from(schema.testRuns).where(inArray(schema.testRuns.suiteId, suiteIds)),
  ]);

  if (runs.length === 0) {
    return { projects: projects.length, tests: tests.n, passRate: null, testMs: 0, runs: 0 };
  }

  const results = await db
    .select({ status: schema.testRunResults.status, durationMs: schema.testRunResults.durationMs })
    .from(schema.testRunResults)
    .where(inArray(schema.testRunResults.runId, runs.map((r) => r.id)));

  const passed = results.filter((r) => r.status === "pass").length;
  return {
    projects: projects.length,
    tests: tests.n,
    passRate: results.length ? Math.round((passed / results.length) * 1000) / 10 : null,
    testMs: results.reduce((n, r) => n + (r.durationMs ?? 0), 0),
    runs: runs.length,
  };
}

/**
 * Test cases with the run history the tests table shows.
 *
 * Journey comes from the owning suite, and status/history/average are derived
 * from this case's results across recent runs — the table's sparkline is
 * meant to be the last few outcomes, not decoration.
 */
export type TestCaseWithStats = Awaited<ReturnType<typeof listTestCasesWithStats>>[number];

export async function listTestCasesWithStats(userId: string, projectId: string, historyLength = 7) {
  const db = getDb();

  const suites = await db
    .select({ id: schema.testSuites.id, name: schema.testSuites.name })
    .from(schema.testSuites)
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.id, projectId)))
    .then((rows) => rows.map((r) => ({ id: r.id, name: r.name })));

  if (suites.length === 0) return [];
  const suiteName = new Map(suites.map((s) => [s.id, s.name ?? "Unassigned"]));

  const cases = await db
    .select()
    .from(schema.testCases)
    .where(inArray(schema.testCases.suiteId, suites.map((s) => s.id)))
    .orderBy(desc(schema.testCases.createdAt));
  if (cases.length === 0) return [];

  // Newest first, so slicing gives the most recent outcomes.
  const results = await db
    .select({
      testCaseId: schema.testRunResults.testCaseId,
      status: schema.testRunResults.status,
      durationMs: schema.testRunResults.durationMs,
      startedAt: schema.testRuns.startedAt,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testRuns, eq(schema.testRunResults.runId, schema.testRuns.id))
    .where(inArray(schema.testRunResults.testCaseId, cases.map((c) => c.id)))
    .orderBy(desc(schema.testRuns.startedAt));

  return cases.map((c) => {
    const mine = results.filter((r) => r.testCaseId === c.id);
    const recent = mine.slice(0, historyLength);
    const durations = mine.map((r) => r.durationMs ?? 0).filter(Boolean);
    return {
      id: c.id,
      name: c.title,
      journey: suiteName.get(c.suiteId) ?? "Unassigned",
      /** What the filter chips match on. */
      tags: [c.type, c.priority, c.automationStatus].filter(Boolean) as string[],
      status: recent[0]?.status ?? null,
      history: recent.map((r) => r.status),
      avgMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      runCount: mine.length,
      executable: Boolean(c.playwrightCode?.trim()),
    };
  });
}

/**
 * The proposed plan, grouped the way the screen renders it.
 *
 * A suite is a journey. "Approved" maps to automation_status = 'automated',
 * which is what the generator sets once a scenario has been accepted and
 * turned into a spec.
 *
 * The demo grouped scenarios as happy-path / edge-case / negative. The schema
 * has no such column — its CHECK constraint limits type to unit/api/ui — so
 * the breakdown is by priority, which is real, rather than inventing a
 * classification the rows do not carry.
 */
export type PlanJourney = Awaited<ReturnType<typeof listTestPlan>>["journeys"][number];

export async function listTestPlan(userId: string, projectId: string) {
  const db = getDb();

  const suites = await db
    .select({ id: schema.testSuites.id, name: schema.testSuites.name })
    .from(schema.testSuites)
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.id, projectId)));

  if (suites.length === 0) return { journeys: [], stats: { total: 0, approved: 0, byPriority: {} as Record<string, number> } };

  const cases = await db
    .select()
    .from(schema.testCases)
    .where(inArray(schema.testCases.suiteId, suites.map((s) => s.id)))
    .orderBy(desc(schema.testCases.createdAt));

  const journeys = suites
    .map((s) => {
      const mine = cases.filter((c) => c.suiteId === s.id);
      return {
        id: s.id,
        name: s.name ?? "Unassigned",
        cases: mine.map((c) => ({
          id: c.id,
          title: c.title,
          expectation: c.expectedResult,
          steps: Array.isArray(c.steps) ? (c.steps as string[]) : [],
          priority: c.priority ?? "medium",
          type: c.type ?? "ui",
          approved: c.automationStatus === "automated",
          executable: Boolean(c.playwrightCode?.trim()),
        })),
      };
    })
    .filter((j) => j.cases.length > 0);

  const byPriority: Record<string, number> = {};
  for (const c of cases) byPriority[c.priority ?? "medium"] = (byPriority[c.priority ?? "medium"] ?? 0) + 1;

  return {
    journeys,
    stats: {
      total: cases.length,
      approved: cases.filter((c) => c.automationStatus === "automated").length,
      byPriority,
    },
  };
}

/** Flips a scenario between accepted and not. Scoped through its project. */
export async function setCaseApproved(userId: string, caseId: string, approved: boolean) {
  const db = getDb();
  const [owned] = await db
    .select({ id: schema.testCases.id })
    .from(schema.testCases)
    .innerJoin(schema.testSuites, eq(schema.testCases.suiteId, schema.testSuites.id))
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(and(eq(schema.testCases.id, caseId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!owned) return null;

  const [row] = await db
    .update(schema.testCases)
    .set({ automationStatus: approved ? "automated" : "manual", updatedAt: new Date() })
    .where(eq(schema.testCases.id, caseId))
    .returning();
  return row;
}

/**
 * One test case with everything its detail page shows: the stored spec, the
 * plain-language steps, and its result history newest first.
 */
export type TestCaseDetail = NonNullable<Awaited<ReturnType<typeof getTestCase>>>;

export async function getTestCase(userId: string, caseId: string) {
  const db = getDb();

  const [row] = await db
    .select({ testCase: schema.testCases, suite: schema.testSuites, project: schema.projects })
    .from(schema.testCases)
    .innerJoin(schema.testSuites, eq(schema.testCases.suiteId, schema.testSuites.id))
    .innerJoin(schema.projects, eq(schema.testSuites.projectId, schema.projects.id))
    .where(and(eq(schema.testCases.id, caseId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!row) return null;

  const history = await db
    .select({
      runId: schema.testRunResults.runId,
      status: schema.testRunResults.status,
      durationMs: schema.testRunResults.durationMs,
      errorMessage: schema.testRunResults.errorMessage,
      screenshotUrl: schema.testRunResults.screenshotUrl,
      startedAt: schema.testRuns.startedAt,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testRuns, eq(schema.testRunResults.runId, schema.testRuns.id))
    .where(eq(schema.testRunResults.testCaseId, caseId))
    .orderBy(desc(schema.testRuns.startedAt))
    .limit(20);

  return {
    ...row.testCase,
    steps: Array.isArray(row.testCase.steps) ? (row.testCase.steps as string[]) : [],
    journey: row.suite.name ?? "Unassigned",
    projectSlug: projectSlug(row.project.name),
    history,
  };
}

/**
 * Analytics for a project, computed from its runs.
 *
 * Pass rate is measured per result rather than per run — a run that is half
 * green is not a binary pass — and the trend is one point per run, oldest
 * first, so the sparkline traces real history rather than a fixed curve.
 *
 * Coverage has no table yet, so it is reported as null and the screen says so
 * instead of printing a number nothing measured.
 */
export type ProjectAnalytics = Awaited<ReturnType<typeof projectAnalytics>>;

export async function projectAnalytics(userId: string, projectId: string) {
  const db = getDb();
  const ids = await ownedSuiteIds(userId, projectId);
  const empty = {
    passRate: null as number | null,
    passRateTrend: [] as number[],
    durationTrend: [] as number[],
    totalRuns: 0,
    totalResults: 0,
    avgDurationMs: null as number | null,
    flakiest: [] as { title: string; failures: number; runs: number }[],
    coverage: null as number | null,
  };
  if (ids.length === 0) return empty;

  const runs = await db
    .select({ id: schema.testRuns.id, startedAt: schema.testRuns.startedAt })
    .from(schema.testRuns)
    .where(inArray(schema.testRuns.suiteId, ids))
    .orderBy(schema.testRuns.startedAt);
  if (runs.length === 0) return empty;

  const results = await db
    .select({
      runId: schema.testRunResults.runId,
      testCaseId: schema.testRunResults.testCaseId,
      status: schema.testRunResults.status,
      durationMs: schema.testRunResults.durationMs,
      title: schema.testCases.title,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testCases, eq(schema.testRunResults.testCaseId, schema.testCases.id))
    .where(inArray(schema.testRunResults.runId, runs.map((r) => r.id)));

  const perRun = runs.map((run) => {
    const mine = results.filter((r) => r.runId === run.id);
    const passed = mine.filter((r) => r.status === "pass").length;
    return {
      pct: mine.length ? Math.round((passed / mine.length) * 100) : 0,
      ms: mine.reduce((n, r) => n + (r.durationMs ?? 0), 0),
    };
  });

  const passed = results.filter((r) => r.status === "pass").length;

  // Cases that have failed at least once, worst first.
  const byCase = new Map<string, { title: string; failures: number; runs: number }>();
  for (const r of results) {
    const entry = byCase.get(r.testCaseId) ?? { title: r.title, failures: 0, runs: 0 };
    entry.runs += 1;
    if (r.status !== "pass") entry.failures += 1;
    byCase.set(r.testCaseId, entry);
  }

  return {
    passRate: results.length ? Math.round((passed / results.length) * 1000) / 10 : null,
    passRateTrend: perRun.map((r) => r.pct),
    durationTrend: perRun.map((r) => Math.round(r.ms / 1000)),
    totalRuns: runs.length,
    totalResults: results.length,
    avgDurationMs: perRun.length
      ? Math.round(perRun.reduce((n, r) => n + r.ms, 0) / perRun.length)
      : null,
    flakiest: [...byCase.values()].filter((c) => c.failures > 0).sort((a, b) => b.failures - a.failures).slice(0, 5),
    coverage: null,
  };
}

/* ------------------------------------------------------------------ */
/* Self-healing                                                        */
/* ------------------------------------------------------------------ */

export type HealingEventView = Awaited<ReturnType<typeof listHealingEvents>>["events"][number];

export async function listHealingEvents(userId: string, projectId: string) {
  const db = getDb();

  const [owned] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!owned) return { events: [], stats: { healedThisMonth: 0, healedToday: 0, hoursSaved: 0, pending: 0 } };

  const rows = await db
    .select({ event: schema.healingEvents, testTitle: schema.testCases.title })
    .from(schema.healingEvents)
    .leftJoin(schema.testCases, eq(schema.healingEvents.testCaseId, schema.testCases.id))
    .where(eq(schema.healingEvents.projectId, projectId))
    .orderBy(desc(schema.healingEvents.createdAt));

  const events = rows.map((r) => ({
    ...r.event,
    // A healing event can outlive the case it repaired, so the title is
    // optional rather than assumed present.
    test: r.testTitle ?? "Test no longer present",
    /**
     * Formatted here rather than in the client component. Rendering "12m ago"
     * on both sides let the clock tick between the server render and
     * hydration, and the differing text failed hydration outright.
     */
    createdAtLabel: relativeLabel(r.event.createdAt),
  }));

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const accepted = events.filter((e) => e.status === "accepted");

  return {
    events,
    stats: {
      healedThisMonth: accepted.filter(
        (e) => e.createdAt && now - e.createdAt.getTime() < 30 * dayMs,
      ).length,
      healedToday: accepted.filter((e) => e.createdAt && now - e.createdAt.getTime() < dayMs).length,
      // Reported in whole hours; the rows store minutes.
      hoursSaved: Math.round(accepted.reduce((n, e) => n + (e.minutesSaved ?? 0), 0) / 60),
      pending: events.filter((e) => e.status === "pending").length,
    },
  };
}

/** Accept or revert a proposed repair. Scoped through the owning project. */
export async function setHealingStatus(
  userId: string,
  eventId: string,
  status: "accepted" | "reverted",
) {
  const db = getDb();
  const [owned] = await db
    .select({ id: schema.healingEvents.id })
    .from(schema.healingEvents)
    .innerJoin(schema.projects, eq(schema.healingEvents.projectId, schema.projects.id))
    .where(and(eq(schema.healingEvents.id, eventId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!owned) return null;

  const [row] = await db
    .update(schema.healingEvents)
    .set({ status, resolvedAt: new Date() })
    .where(eq(schema.healingEvents.id, eventId))
    .returning();
  return row;
}

/* ------------------------------------------------------------------ */
/* Quarantine, discovery, notifications                                */
/* ------------------------------------------------------------------ */

export type QuarantinedView = Awaited<ReturnType<typeof listQuarantined>>[number];

export async function listQuarantined(userId: string, projectId: string) {
  const db = getDb();
  const rows = await db
    .select({ q: schema.quarantinedTests, title: schema.testCases.title })
    .from(schema.quarantinedTests)
    .innerJoin(schema.projects, eq(schema.quarantinedTests.projectId, schema.projects.id))
    .leftJoin(schema.testCases, eq(schema.quarantinedTests.testCaseId, schema.testCases.id))
    .where(and(eq(schema.projects.userId, userId), eq(schema.quarantinedTests.projectId, projectId)))
    .orderBy(desc(schema.quarantinedTests.quarantinedAt));
  return rows.map((r) => ({ ...r.q, test: r.title ?? "Test no longer present" }));
}

/** Releases a test back into the gate. */
export async function releaseQuarantined(userId: string, id: string) {
  const db = getDb();
  const [owned] = await db
    .select({ id: schema.quarantinedTests.id })
    .from(schema.quarantinedTests)
    .innerJoin(schema.projects, eq(schema.quarantinedTests.projectId, schema.projects.id))
    .where(and(eq(schema.quarantinedTests.id, id), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!owned) return null;

  const [row] = await db
    .update(schema.quarantinedTests)
    .set({ status: "released", releasedAt: new Date() })
    .where(eq(schema.quarantinedTests.id, id))
    .returning();
  return row;
}

export type DiscoveryView = Awaited<ReturnType<typeof listDiscovery>>;

export async function listDiscovery(userId: string, projectId: string) {
  const db = getDb();
  const [owned] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);
  if (!owned) return { pages: [], endpoints: [], journeys: 0 };

  const [pages, endpoints, suites] = await Promise.all([
    db.select().from(schema.discoveredPages).where(eq(schema.discoveredPages.projectId, projectId)),
    db.select().from(schema.apiEndpoints).where(eq(schema.apiEndpoints.projectId, projectId)).orderBy(schema.apiEndpoints.firstSeenSec),
    db.select({ id: schema.testSuites.id }).from(schema.testSuites).where(eq(schema.testSuites.projectId, projectId)),
  ]);

  return { pages, endpoints, journeys: suites.length };
}

export type NotificationView = typeof schema.notifications.$inferSelect;

export async function listNotifications(userId: string) {
  const db = getDb();
  const projects = await listProjects(userId);
  if (projects.length === 0) return [];
  return db
    .select()
    .from(schema.notifications)
    .where(inArray(schema.notifications.projectId, projects.map((p) => p.id)))
    .orderBy(desc(schema.notifications.createdAt));
}

export async function markNotificationsRead(userId: string) {
  const db = getDb();
  const projects = await listProjects(userId);
  if (projects.length === 0) return 0;
  const rows = await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(inArray(schema.notifications.projectId, projects.map((p) => p.id)))
    .returning({ id: schema.notifications.id });
  return rows.length;
}

/* ------------------------------------------------------------------ */
/* Discovery, application map, notifications                           */
/* ------------------------------------------------------------------ */

/** Rolls the crawl up into the counts the discovery and map screens quote. */
export async function discoverySummary(userId: string, projectId: string) {
  const { pages, endpoints, journeys } = await listDiscovery(userId, projectId);
  return {
    pages,
    endpoints,
    stats: {
      pages: pages.length,
      journeys,
      apis: endpoints.length,
      gated: pages.filter((p) => p.gated).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Root cause, risk, baseline, release gate                            */
/* ------------------------------------------------------------------ */

/**
 * Failures grouped by the error they produced.
 *
 * The category is inferred from the message rather than stored: Playwright's
 * text distinguishes a strict-mode violation from a timeout from a failed
 * assertion, and grouping on it is what turns twenty failures into three
 * causes. Confidence reflects how many failures share the pattern.
 */
function categorise(message: string): { category: string; confidence: number } {
  const m = message.toLowerCase();
  if (m.includes("strict mode violation")) return { category: "Ambiguous locator", confidence: 95 };
  if (m.includes("test timeout")) return { category: "Timeout", confidence: 80 };
  if (m.includes("err_connection") || m.includes("net::")) return { category: "Environment", confidence: 88 };
  if (m.includes("tobevisible") || m.includes("element(s) not found")) return { category: "Selector drift", confidence: 84 };
  if (m.includes("expect(")) return { category: "Assertion", confidence: 72 };
  return { category: "Uncategorised", confidence: 40 };
}

export async function rootCauseAnalysis(userId: string, projectId: string) {
  const db = getDb();
  const ids = await ownedSuiteIds(userId, projectId);
  if (ids.length === 0) return { groups: [], summary: { totalFailures: 0, identified: 0, highConfidence: 0, unresolved: 0 } };

  const failures = await db
    .select({
      resultId: schema.testRunResults.id,
      runId: schema.testRunResults.runId,
      status: schema.testRunResults.status,
      errorMessage: schema.testRunResults.errorMessage,
      screenshotUrl: schema.testRunResults.screenshotUrl,
      title: schema.testCases.title,
      startedAt: schema.testRuns.startedAt,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testRuns, eq(schema.testRunResults.runId, schema.testRuns.id))
    .innerJoin(schema.testCases, eq(schema.testRunResults.testCaseId, schema.testCases.id))
    .where(inArray(schema.testRuns.suiteId, ids))
    .orderBy(desc(schema.testRuns.startedAt));

  const failed = failures.filter((f) => f.status !== "pass" && f.errorMessage);

  const byCategory = new Map<string, typeof failed>();
  for (const f of failed) {
    const { category } = categorise(f.errorMessage ?? "");
    byCategory.set(category, [...(byCategory.get(category) ?? []), f]);
  }

  const groups = [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      confidence: categorise(items[0].errorMessage ?? "").confidence,
      occurrences: items.length,
      tests: [...new Set(items.map((i) => i.title))],
      latest: items[0],
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  return {
    groups,
    summary: {
      totalFailures: failed.length,
      identified: groups.filter((g) => g.category !== "Uncategorised").reduce((n, g) => n + g.occurrences, 0),
      highConfidence: groups.filter((g) => g.confidence >= 80).reduce((n, g) => n + g.occurrences, 0),
      unresolved: groups.find((g) => g.category === "Uncategorised")?.occurrences ?? 0,
    },
  };
}

/** File risk, straight from the scores table. */
export async function listRiskScores(userId: string, projectId: string) {
  const db = getDb();
  return db
    .select({ r: schema.riskScores })
    .from(schema.riskScores)
    .innerJoin(schema.projects, eq(schema.riskScores.projectId, schema.projects.id))
    .where(and(eq(schema.projects.userId, userId), eq(schema.riskScores.projectId, projectId)))
    .orderBy(desc(schema.riskScores.compositeRiskScore))
    .then((rows) =>
      rows.map((x) => ({
        filePath: x.r.filePath,
        churn: Number(x.r.changeFrequencyScore ?? 0),
        complexity: Number(x.r.complexityScore ?? 0),
        risk: Number(x.r.compositeRiskScore ?? 0),
        calculatedAt: x.r.calculatedAt,
      })),
    );
}

/**
 * Release readiness from signals that exist: the latest run's pass rate, tests
 * still quarantined, and healing repairs nobody has reviewed.
 */
export async function releaseGate(userId: string, projectId: string) {
  const [runs, quarantined, healing] = await Promise.all([
    listRunsWithCounts(userId, projectId, 5),
    listQuarantined(userId, projectId),
    listHealingEvents(userId, projectId),
  ]);

  const latest = runs[0] ?? null;
  const passRate = latest && latest.total ? Math.round((latest.passed / latest.total) * 1000) / 10 : null;
  const stillQuarantined = quarantined.filter((q) => q.status === "quarantined").length;
  const awaitingReview = healing.events.filter((e) => e.status === "pending").length;

  const conditions: string[] = [];
  if (passRate !== null && passRate < 100) conditions.push(`${latest?.failed ?? 0} test(s) failing in the latest run.`);
  if (stillQuarantined > 0) conditions.push(`${stillQuarantined} test(s) still quarantined and excluded from the gate.`);
  if (awaitingReview > 0) conditions.push(`${awaitingReview} healed locator(s) awaiting review.`);

  // No run at all is not a pass; it is an absence of evidence.
  const verdict: "GO" | "NO-GO" | "CONDITIONAL" =
    latest === null ? "NO-GO" : passRate === 100 && conditions.length === 0 ? "GO" : passRate !== null && passRate < 50 ? "NO-GO" : "CONDITIONAL";

  return {
    verdict,
    latestRun: latest,
    passRate,
    conditions,
    stillQuarantined,
    awaitingReview,
    runsConsidered: runs.length,
  };
}

/**
 * File risk shaped for the defect-prediction screen.
 *
 * The level is banded from the composite score rather than stored, so the
 * bands stay in one place; churn drives the map's tile widths.
 */
export type RiskFile = Awaited<ReturnType<typeof defectPrediction>>["files"][number];

export async function defectPrediction(userId: string, projectId: string) {
  const scores = await listRiskScores(userId, projectId);
  const files = scores.map((s) => ({
    filename: s.filePath,
    riskScore: Math.round(s.risk),
    riskLevel: (s.risk >= 75 ? "critical" : s.risk >= 50 ? "high" : s.risk >= 25 ? "medium" : "low") as
      | "critical" | "high" | "medium" | "low",
    churn: Math.round(s.churn),
    complexity: Math.round(s.complexity),
  }));
  return {
    files,
    filesAnalysed: files.length,
    highRisk: files.filter((f) => f.riskScore >= 50).length,
    critical: files.filter((f) => f.riskLevel === "critical").length,
  };
}

/**
 * Tests ordered by risk exposure.
 *
 * Priority is composed from what the data supports: recent failures dominate,
 * the stored case priority contributes, and a quarantined test is always
 * treated as a known failure.
 */
export type RankedTestView = Awaited<ReturnType<typeof rankedTests>>[number];

export async function rankedTests(userId: string, projectId: string) {
  const [cases, quarantined] = await Promise.all([
    listTestCasesWithStats(userId, projectId, 10),
    listQuarantined(userId, projectId),
  ]);
  const quarantinedIds = new Set(quarantined.filter((q) => q.status === "quarantined").map((q) => q.testCaseId));

  const weight: Record<string, number> = { critical: 30, high: 22, medium: 12, low: 4 };

  return cases
    .map((c) => {
      const failures = c.history.filter((h) => h !== "pass").length;
      const failureShare = c.history.length ? failures / c.history.length : 0;
      const known = quarantinedIds.has(c.id) || failures > 0;
      const priority = Math.min(
        100,
        Math.round(failureShare * 60 + (weight[c.tags[1] ?? "medium"] ?? 12) + (quarantinedIds.has(c.id) ? 20 : 0)),
      );
      return {
        id: c.id,
        name: c.name,
        journey: c.journey,
        priority,
        knownFailure: known,
        status: c.status,
        reason: quarantinedIds.has(c.id)
          ? "Quarantined for unstable results; excluded from the gate."
          : failures > 0
            ? `Failed ${failures} of the last ${c.history.length} runs.`
            : `Stable across ${c.history.length} recent run(s).`,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}
