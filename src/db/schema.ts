/**
 * Drizzle schema for Parikshan.
 *
 * These tables already existed in the provisioned Neon database, so this file
 * mirrors the live shape rather than inventing a new one — no destructive
 * migration is needed to adopt it. `user_id` is a Clerk subject id (text, not
 * a uuid), which is why it is not a foreign key.
 */
import { relations } from "drizzle-orm";
/**
 * The CHECK constraints below are enforced in the database. They are mirrored
 * here as string unions so an invalid value fails to compile rather than
 * failing at insert time.
 */
export const SUITE_SOURCE = ["requirement", "repo_scan", "manual"] as const;
export const CASE_TYPE = ["unit", "api", "ui"] as const;
export const CASE_PRIORITY = ["low", "medium", "high", "critical"] as const;
export const AUTOMATION_STATUS = ["manual", "automated", "not_applicable"] as const;
export const RUN_TRIGGER = ["manual", "automated"] as const;
export const RUN_STATUS = ["queued", "running", "passed", "failed", "partial", "error"] as const;
export const RESULT_STATUS = ["pass", "fail", "error", "skipped"] as const;
export const REQUIREMENT_SOURCE = ["manual", "imported"] as const;
export const CONFIDENCE = ["low", "medium", "high"] as const;
export const JOB_TYPE = ["generate_tests", "repo_scan", "run_suite", "recalculate_coverage", "recalculate_risk"] as const;
export const JOB_STATUS = ["queued", "running", "done", "failed"] as const;

import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  githubRepoUrl: text("github_repo_url"),
  githubDefaultBranch: text("github_default_branch"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  source: text("source").$type<(typeof REQUIREMENT_SOURCE)[number]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const testSuites = pgTable("test_suites", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id"),
  requirementId: uuid("requirement_id"),
  name: text("name"),
  source: text("source").$type<(typeof SUITE_SOURCE)[number]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").$type<(typeof CASE_TYPE)[number]>(),
  /** Ordered plain-language steps; the shape the plan screen renders. */
  steps: jsonb("steps").$type<string[]>().notNull(),
  expectedResult: text("expected_result").notNull(),
  priority: text("priority").$type<(typeof CASE_PRIORITY)[number]>(),
  priorityRationale: text("priority_rationale"),
  generatedByAi: boolean("generated_by_ai"),
  automationStatus: text("automation_status").$type<(typeof AUTOMATION_STATUS)[number]>(),
  playwrightCode: text("playwright_code"),
  filePathHint: text("file_path_hint"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const testRuns = pgTable("test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").notNull(),
  triggeredBy: text("triggered_by").$type<(typeof RUN_TRIGGER)[number]>(),
  status: text("status").$type<(typeof RUN_STATUS)[number]>(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const testRunResults = pgTable("test_run_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  testCaseId: uuid("test_case_id").notNull(),
  status: text("status").$type<(typeof RESULT_STATUS)[number]>(),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  logs: text("logs"),
  screenshotUrl: text("screenshot_url"),
});

export const riskScores = pgTable("risk_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  filePath: text("file_path").notNull(),
  changeFrequencyScore: numeric("change_frequency_score"),
  complexityScore: numeric("complexity_score"),
  compositeRiskScore: numeric("composite_risk_score"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
});

export const coverageSnapshots = pgTable("coverage_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  runId: uuid("run_id"),
  filePath: text("file_path").notNull(),
  isCovered: boolean("is_covered"),
  mappedTestCaseIds: text("mapped_test_case_ids").array(),
  estimatedConfidence: text("estimated_confidence").$type<(typeof CONFIDENCE)[number]>(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: text("job_type").$type<(typeof JOB_TYPE)[number]>(),
  status: text("status").$type<(typeof JOB_STATUS)[number]>(),
  projectId: uuid("project_id"),
  payload: jsonb("payload"),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const githubConnections = pgTable("github_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  githubUsername: text("github_username"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow(),
});

/* ---- Relations, so queries can join without hand-written SQL ---- */

export const projectsRelations = relations(projects, ({ many }) => ({
  suites: many(testSuites),
  requirements: many(requirements),
}));

export const testSuitesRelations = relations(testSuites, ({ one, many }) => ({
  project: one(projects, { fields: [testSuites.projectId], references: [projects.id] }),
  cases: many(testCases),
  runs: many(testRuns),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  suite: one(testSuites, { fields: [testCases.suiteId], references: [testSuites.id] }),
  results: many(testRunResults),
}));

export const testRunsRelations = relations(testRuns, ({ one, many }) => ({
  suite: one(testSuites, { fields: [testRuns.suiteId], references: [testSuites.id] }),
  results: many(testRunResults),
}));

export const testRunResultsRelations = relations(testRunResults, ({ one }) => ({
  run: one(testRuns, { fields: [testRunResults.runId], references: [testRuns.id] }),
  testCase: one(testCases, { fields: [testRunResults.testCaseId], references: [testCases.id] }),
}));

export type Project = typeof projects.$inferSelect;
export type TestSuite = typeof testSuites.$inferSelect;
export type TestCase = typeof testCases.$inferSelect;
export type TestRun = typeof testRuns.$inferSelect;
export type TestRunResult = typeof testRunResults.$inferSelect;
