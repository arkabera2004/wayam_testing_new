/**
 * Drizzle schema for Parikshan.
 *
 * These tables already existed in the provisioned Neon database, so this file
 * mirrors the live shape rather than inventing a new one - no destructive
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
  /** Where the app actually runs, so generated specs have somewhere to go. */
  baseUrl: text("base_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const REQUIREMENT_KIND = ["functional", "non-functional", "security", "accessibility"] as const;
export const REQUIREMENT_PRIORITY = ["P0", "P1", "P2"] as const;

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  /** The PRD this was extracted from, when it came from one. */
  prdId: uuid("prd_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").$type<(typeof REQUIREMENT_KIND)[number]>(),
  priority: text("priority").$type<(typeof REQUIREMENT_PRIORITY)[number]>(),
  /** Set when the requirement cannot be tested as written. */
  ambiguity: text("ambiguity"),
  source: text("source").$type<(typeof REQUIREMENT_SOURCE)[number]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const PRD_STATUS = ["analyzing", "analyzed", "failed"] as const;

export const prdDocuments = pgTable("prd_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  name: text("name").notNull(),
  body: text("body"),
  status: text("status").$type<(typeof PRD_STATUS)[number]>().default("analyzed"),
  sizeBytes: integer("size_bytes"),
  sections: integer("sections"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

/* ---- Code review ---- */

export const REVIEW_RECOMMENDATION = ["APPROVE", "REQUEST_CHANGES", "COMMENT"] as const;
export const REVIEW_SEVERITY = ["critical", "high", "medium", "low"] as const;
export const REVIEW_CATEGORY = ["security", "bug", "performance", "style", "test-coverage", "maintainability"] as const;

export const codeReviews = pgTable("code_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  sha: text("sha").notNull(),
  message: text("message").notNull(),
  author: text("author"),
  recommendation: text("recommendation").$type<(typeof REVIEW_RECOMMENDATION)[number]>(),
  summary: text("summary"),
  /** Free-text findings that are not anchored to a line. */
  securityFlags: jsonb("security_flags").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const codeReviewComments = pgTable("code_review_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").notNull(),
  file: text("file").notNull(),
  line: integer("line"),
  severity: text("severity").$type<(typeof REVIEW_SEVERITY)[number]>(),
  category: text("category").$type<(typeof REVIEW_CATEGORY)[number]>(),
  title: text("title").notNull(),
  body: text("body"),
  suggestion: text("suggestion"),
});

/* ---- Tests derived from documents ---- */

export const DOC_SCENARIO_TAG = ["happy-path", "edge-case", "negative"] as const;

export const docSources = pgTable("doc_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  name: text("name").notNull(),
  sizeBytes: integer("size_bytes"),
  sections: integer("sections"),
  parsedAt: timestamp("parsed_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const docScenarios = pgTable("doc_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  docId: uuid("doc_id").notNull(),
  title: text("title").notNull(),
  expectation: text("expectation"),
  /** Where in the document this came from, e.g. "§2.1 Express checkout". */
  source: text("source"),
  tag: text("tag").$type<(typeof DOC_SCENARIO_TAG)[number]>(),
  selected: boolean("selected").default(true),
});

/* ---- Test selection for a diff ---- */

export const testSelections = pgTable("test_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  oldSha: text("old_sha"),
  newSha: text("new_sha"),
  changedFiles: jsonb("changed_files").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

/* ---- Imported repository files ---- */

export const repoFiles = pgTable("repo_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  path: text("path").notNull(),
  sizeBytes: integer("size_bytes"),
  /** Git blob sha, so a re-import can tell what actually changed. */
  sha: text("sha"),
  /** Only kept for files small enough to be worth reading. */
  content: text("content"),
  importedAt: timestamp("imported_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const repoImports = pgTable("repo_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  repoUrl: text("repo_url").notNull(),
  ref: text("ref"),
  commitSha: text("commit_sha"),
  fileCount: integer("file_count").default(0),
  /** Files whose contents were stored, which is a subset of fileCount. */
  storedCount: integer("stored_count").default(0),
  framework: text("framework"),
  truncated: boolean("truncated").default(false),
  importedAt: timestamp("imported_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

/* ---- API keys ---- */

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  /** Shown in the UI. The secret itself is only ever stored hashed. */
  prefix: text("prefix").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
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
  /**
   * These two columns have no database default, unlike created_at/updated_at
   * elsewhere. `$defaultFn` makes Drizzle supply the value on insert, so a run
   * can never land with a null start time and sort to the bottom.
   */
  startedAt: timestamp("started_at", { withTimezone: true }).$defaultFn(() => new Date()),
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

/* ------------------------------------------------------------------ */
/* Tables added for the screens that had no backing store              */
/* ------------------------------------------------------------------ */

export const HEALING_STATUS = ["pending", "accepted", "reverted"] as const;

/**
 * A locator Parikshan repaired on its own.
 *
 * Keyed to the test case whose selector changed, and to the run that exposed
 * it, so a healing event can always be traced back to the failure that
 * triggered it.
 */
export const healingEvents = pgTable("healing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  testCaseId: uuid("test_case_id"),
  runId: uuid("run_id"),
  oldSelector: text("old_selector").notNull(),
  newSelector: text("new_selector").notNull(),
  /** How the replacement was found: dom-similarity, text-match, position. */
  strategy: text("strategy"),
  /** 0-100. Stored as an integer so the UI never has to round a float. */
  similarity: integer("similarity"),
  reason: text("reason"),
  status: text("status").$type<(typeof HEALING_STATUS)[number]>().default("pending"),
  /** Minutes of manual repair this saved, used for the maintenance figure. */
  minutesSaved: integer("minutes_saved").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const QUARANTINE_STATUS = ["quarantined", "released"] as const;

/** A test held out of the gate because it fails unpredictably. */
export const quarantinedTests = pgTable("quarantined_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  testCaseId: uuid("test_case_id"),
  reason: text("reason").notNull(),
  /** Plain-language description of when it fails. */
  pattern: text("pattern"),
  /** Failures per hundred runs. */
  flakyRate: integer("flaky_rate"),
  status: text("status").$type<(typeof QUARANTINE_STATUS)[number]>().default("quarantined"),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }).$defaultFn(() => new Date()),
  releasedAt: timestamp("released_at", { withTimezone: true }),
});

/** A page the crawler reached, and what it found there. */
export const discoveredPages = pgTable("discovered_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  path: text("path").notNull(),
  title: text("title").notNull(),
  forms: integer("forms").default(0),
  apis: integer("apis").default(0),
  gated: boolean("gated").default(false),
  risk: text("risk"),
  /** The file this route came from, so a generated spec can read its markup. */
  sourceFile: text("source_file"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

/** An endpoint observed in network traffic during the crawl. */
export const apiEndpoints = pgTable("api_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  status: integer("status"),
  /** Seconds into the crawl when it was first seen. */
  firstSeenSec: integer("first_seen_sec"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const NOTIFICATION_TYPE = ["passed", "failed", "flaky", "healing", "quarantine"] as const;

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id"),
  type: text("type").$type<(typeof NOTIFICATION_TYPE)[number]>().notNull(),
  title: text("title").notNull(),
  body: text("body"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export type HealingEvent = typeof healingEvents.$inferSelect;
export type QuarantinedTest = typeof quarantinedTests.$inferSelect;
export type DiscoveredPage = typeof discoveredPages.$inferSelect;
export type ApiEndpoint = typeof apiEndpoints.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
