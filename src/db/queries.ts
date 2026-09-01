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
