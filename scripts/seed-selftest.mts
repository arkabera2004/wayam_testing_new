/**
 * Seeds a project whose specs genuinely execute.
 *
 * The ShopStack demo targets shopstack.demo, which does not exist, so its
 * specs can never run. This project points at the running Parikshan instance
 * instead, so "Run suite" performs real browser work and the pass/fail you see
 * reflects the app's actual behaviour.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-selftest.mts
 */
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../src/db/index.js";

const OWNER = process.env.SEED_USER_ID ?? "demo-user";
const NAME = "Parikshan Self-Test";
const db = getDb();

/** Each body is the inside of a Playwright test; BASE is injected below. */
const CASES: { title: string; expected: string; body: string }[] = [
  {
    title: "Projects page lists at least one project",
    expected: "The projects table renders a row read from the database.",
    body: [
      'await page.goto(BASE + "/projects");',
      // exact: "Projects" also substring-matches the "All projects" card
      // heading, and an ambiguous locator is a strict-mode failure.
      'await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();',
      'await expect(page.locator("tbody tr").first()).toBeVisible();',
    ].join("\n  "),
  },
  {
    title: "Project overview renders real aggregates",
    expected: "The overview shows the project name and its stat cards.",
    body: [
      'await page.goto(BASE + "/projects/shopstack");',
      'await expect(page.getByRole("heading", { name: "ShopStack" })).toBeVisible();',
      'await expect(page.getByText("Pass rate")).toBeVisible();',
    ].join("\n  "),
  },
  {
    title: "Runs table renders rows with tallies",
    expected: "Each run shows aggregated pass and fail counts.",
    body: [
      'await page.goto(BASE + "/projects/shopstack/runs");',
      'await expect(page.getByRole("heading", { name: "Runs", exact: true })).toBeVisible();',
      'await expect(page.locator("tbody tr").first()).toBeVisible();',
    ].join("\n  "),
  },
  {
    title: "Projects API returns a JSON array",
    expected: "GET /api/projects answers 200 with a projects array.",
    body: [
      'const res = await page.request.get(BASE + "/api/projects");',
      "expect(res.status()).toBe(200);",
      "const body = await res.json();",
      "expect(Array.isArray(body.projects)).toBe(true);",
    ].join("\n  "),
  },
  {
    title: "Sidebar navigates to the Test Plan",
    expected: "Clicking a nav item routes to the plan screen.",
    body: [
      'await page.goto(BASE + "/projects/shopstack");',
      'await page.getByRole("link", { name: "Test Plan" }).click();',
      "await expect(page).toHaveURL(/plan/);",
    ].join("\n  "),
  },
  {
    title: "Unknown project id is not found",
    expected: "A project that does not exist must not return another tenant's data.",
    body: [
      'const res = await page.request.get(BASE + "/api/projects/00000000-0000-0000-0000-000000000000");',
      "expect(res.status()).toBe(404);",
    ].join("\n  "),
  },
];

function specFor(c: { title: string; body: string }) {
  return [
    'import { test, expect } from "@playwright/test";',
    "",
    'const BASE = process.env.BASE_URL ?? "http://localhost:3000";',
    "",
    "test(" + JSON.stringify(c.title) + ", async ({ page }) => {",
    "  " + c.body,
    "});",
    "",
  ].join("\n");
}

const [existing] = await db
  .select()
  .from(schema.projects)
  .where(and(eq(schema.projects.userId, OWNER), eq(schema.projects.name, NAME)))
  .limit(1);

const project =
  existing ??
  (
    await db
      .insert(schema.projects)
      .values({
        userId: OWNER,
        name: NAME,
        description: "Runs real Playwright specs against this running instance",
        githubDefaultBranch: "main",
      })
      .returning()
  )[0];

// Replace the tree so re-running rebuilds cleanly instead of duplicating.
const oldSuites = await db.select().from(schema.testSuites).where(eq(schema.testSuites.projectId, project.id));
for (const s of oldSuites) {
  const runs = await db.select().from(schema.testRuns).where(eq(schema.testRuns.suiteId, s.id));
  for (const r of runs) await db.delete(schema.testRunResults).where(eq(schema.testRunResults.runId, r.id));
  await db.delete(schema.testRuns).where(eq(schema.testRuns.suiteId, s.id));
  await db.delete(schema.testCases).where(eq(schema.testCases.suiteId, s.id));
}
await db.delete(schema.testSuites).where(eq(schema.testSuites.projectId, project.id));

const [suite] = await db
  .insert(schema.testSuites)
  .values({ projectId: project.id, name: "Application smoke", source: "manual" })
  .returning();

for (const c of CASES) {
  await db.insert(schema.testCases).values({
    suiteId: suite.id,
    title: c.title,
    description: c.expected,
    type: "ui",
    steps: [],
    expectedResult: c.expected,
    priority: "medium",
    generatedByAi: false,
    automationStatus: "automated",
    playwrightCode: specFor(c),
  });
}

console.log("project  " + project.name + " (" + project.id + ")");
console.log("suite    " + suite.name);
console.log("specs    " + CASES.length + " with executable Playwright code");
