// Parikshan v1 collection shapes.
//
// MongoDB has no row-level security, so every domain document still carries
// orgId (mirroring the org_id-scoped-table design from the original data
// model) but the isolation guarantee lives in code: src/lib/data/org-access.server.ts
// is the only place allowed to read/write these collections, and every
// function there takes the caller's userId and checks organization_members
// before touching anything. Never query a collection below directly from a
// route/server function — go through that data-access layer.
//
// NOTE: these files use relative imports (not the "@/..." alias) on purpose
// so tests/org-isolation.test.ts can run them directly under plain
// `node --test` without a bundler, which doesn't understand tsconfig path
// aliases.
import type { ObjectId } from "mongodb";

export type OrgRole = "admin" | "editor" | "viewer";

export interface OrganizationDoc {
  _id: ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMemberDoc {
  _id: ObjectId;
  orgId: ObjectId;
  userId: ObjectId;
  role: OrgRole;
  createdAt: Date;
}

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  fullName: string | null;
  createdAt: Date;
}

// The session token itself is the _id, so lookups are a single indexed
// point-read. Tokens are opaque (random bytes) — never a JWT — so nothing
// about the session can be inferred or forged client-side.
export interface SessionDoc {
  _id: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

export interface OrganizationInviteDoc {
  _id: ObjectId;
  orgId: ObjectId;
  email: string;
  role: OrgRole;
  invitedBy: ObjectId | null;
  createdAt: Date;
  acceptedAt: Date | null;
}

export type ProjectSourceType = "github" | "url";

export interface ProjectDoc {
  _id: ObjectId;
  orgId: ObjectId;
  name: string;
  sourceType: ProjectSourceType;
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPlanDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ScenarioType = "E2E" | "API" | "Regression" | "Accessibility" | "Visual";
export type ScenarioStatus = "proposed" | "accepted" | "rejected";
export type ScenarioPriority = "critical" | "high" | "medium" | "low";

export interface TestScenarioDoc {
  _id: ObjectId;
  orgId: ObjectId;
  testPlanId: ObjectId;
  type: ScenarioType;
  title: string;
  description: string;
  status: ScenarioStatus;
  priority: ScenarioPriority;
  filePath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CaseStatus = "passing" | "failing" | "flaky" | "not_run";

export interface TestCaseDoc {
  _id: ObjectId;
  orgId: ObjectId;
  scenarioId: ObjectId;
  generatedCode: string;
  language: string;
  framework: string;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type RunTrigger = "manual" | "on_pr" | "scheduled";
export type RunStatus = "passed" | "failed" | "running" | "flaky";

export interface TestRunDoc {
  _id: ObjectId;
  orgId: ObjectId;
  projectId: ObjectId;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
}

export type ResultStatus = "passed" | "failed" | "flaky" | "skipped";

export interface RunResultDoc {
  _id: ObjectId;
  orgId: ObjectId;
  runId: ObjectId;
  testCaseId: ObjectId;
  status: ResultStatus;
  durationMs: number;
  errorMessage: string | null;
  createdAt: Date;
  // Self-healing fallback (see services/crawl-agent/app/heal.py):
  // populated when a failing locator on a scheduled/PR run was handed to
  // the browser-use agent to re-locate. healedSelector is the agent's
  // proposed replacement (not yet applied to the test case's generated
  // code — that's a human-in-the-loop review step, same as accepting a
  // proposed scenario); healNote carries its confidence/reasoning.
  healedSelector: string | null;
  healNote: string | null;
}

export type IntegrationProvider = "github" | "slack" | "jira";
export type IntegrationStatus = "connected" | "not_connected";

export interface IntegrationDoc {
  _id: ObjectId;
  orgId: ObjectId;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyDoc {
  _id: ObjectId;
  orgId: ObjectId;
  name: string;
  keyPrefix: string;
  keyHash: string;
  createdBy: ObjectId | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}
