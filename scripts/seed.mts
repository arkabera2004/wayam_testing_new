/**
 * Seeds the demo project into the real database.
 *
 * Idempotent: keyed on (userId, name), so re-running updates rather than
 * duplicating. Run with:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed.mts
 */
import { eq, and } from "drizzle-orm";

import { getDb, schema } from "../src/db/index.js";
import { generatedTests, journeys, project, runs, testPlan } from "../src/lib/demo-data.js";

/**
 * Tenant to seed under. Matches the id the app runs as while authentication is
 * out; override it to seed for a different owner.
 */
const DEMO_USER = process.env.SEED_USER_ID ?? "demo-user";
const db = getDb();

const [existing] = await db
  .select()
  .from(schema.projects)
  .where(and(eq(schema.projects.userId, DEMO_USER), eq(schema.projects.name, project.name)))
  .limit(1);

const proj =
  existing ??
  (
    await db
      .insert(schema.projects)
      .values({
        userId: DEMO_USER,
        name: project.name,
        description: `Testing ${project.url}`,
        githubRepoUrl: `https://github.com/${project.repo}`,
        githubDefaultBranch: project.branch,
      })
      .returning()
  )[0];

console.log(`project ${proj.name} (${proj.id})`);

// Clear this project's tree so a re-seed is a clean replace.
const oldSuites = await db.select({ id: schema.testSuites.id }).from(schema.testSuites).where(eq(schema.testSuites.projectId, proj.id));
for (const s of oldSuites) {
  const oldRuns = await db.select({ id: schema.testRuns.id }).from(schema.testRuns).where(eq(schema.testRuns.suiteId, s.id));
  for (const r of oldRuns) await db.delete(schema.testRunResults).where(eq(schema.testRunResults.runId, r.id));
  await db.delete(schema.testRuns).where(eq(schema.testRuns.suiteId, s.id));
  await db.delete(schema.testCases).where(eq(schema.testCases.suiteId, s.id));
}
await db.delete(schema.testSuites).where(eq(schema.testSuites.projectId, proj.id));

// One suite per journey, so the plan screen's grouping survives the round trip.
const suiteByJourney = new Map<string, string>();
for (const j of journeys) {
  const [row] = await db
    .insert(schema.testSuites)
    .values({ projectId: proj.id, name: j.name, source: "requirement" })
    .returning();
  // testPlan rows reference the journey by id ("checkout"), not display name.
  suiteByJourney.set(j.id, row.id);
}
console.log(`suites: ${suiteByJourney.size}`);

const fallbackSuite = [...suiteByJourney.values()][0];
const caseIdByDemoId = new Map<string, string>();

for (const c of testPlan) {
  const suiteId = suiteByJourney.get(c.journey) ?? fallbackSuite;
  const [row] = await db
    .insert(schema.testCases)
    .values({
      suiteId,
      title: c.title,
      description: c.expectation,
      type: "ui",
      steps: c.steps ?? [],
      expectedResult: c.expectation,
      priority: c.tags?.includes("negative") ? "high" : "medium",
      generatedByAi: true,
      automationStatus: c.approved ? "automated" : "manual",
    })
    .returning();
  caseIdByDemoId.set(c.id, row.id);
}
console.log(`test cases: ${caseIdByDemoId.size}`);

// Attach the generated specs' playwright code where the ids line up.
for (const t of generatedTests) {
  const id = caseIdByDemoId.get(t.id);
  if (!id) continue;
  await db
    .update(schema.testCases)
    .set({ automationStatus: "automated", filePathHint: t.file })
    .where(eq(schema.testCases.id, id));
}

// Runs, newest last so startedAt ordering is sane.
const caseIds = [...caseIdByDemoId.values()];
let runCount = 0;
const now = Date.now();
for (const [i, r] of [...runs].reverse().entries()) {
  const [run] = await db
    .insert(schema.testRuns)
    .values({
      suiteId: fallbackSuite,
      triggeredBy: r.trigger.startsWith("PR") || r.trigger === "cron" ? "automated" : "manual",
      status: r.status === "flaky" ? "partial" : r.status,
      // Oldest first, roughly six hours apart, so "last run" is meaningful.
      startedAt: new Date(now - (runs.length - i) * 6 * 60 * 60 * 1000),
      finishedAt: new Date(now - (runs.length - i) * 6 * 60 * 60 * 1000 + 72_000),
    })
    .returning();
  runCount++;
  for (const cid of caseIds.slice(0, 8)) {
    await db.insert(schema.testRunResults).values({
      runId: run.id,
      testCaseId: cid,
      status: r.failed > 0 && cid === caseIds[0] ? "fail" : "pass",
      durationMs: 1200 + Math.round(caseIds.indexOf(cid) * 310),
    });
  }
}
console.log(`runs: ${runCount}`);
console.log("seed complete");
