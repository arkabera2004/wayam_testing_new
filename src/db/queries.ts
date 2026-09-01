import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

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
