import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { RunResultDoc, TestRunDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";
import { healLocatorFn, type HealResult } from "@/lib/crawl/functions";

export interface PublicRun {
  id: string;
  trigger: TestRunDoc["trigger"];
  status: TestRunDoc["status"];
  startedAt: string;
  finishedAt: string | null;
  passed: number;
  failed: number;
  durationMs: number;
}

export interface PublicRunResult {
  id: string;
  testCaseId: string;
  scenarioTitle: string;
  filePath: string | null;
  status: RunResultDoc["status"];
  durationMs: number;
  errorMessage: string | null;
  healedSelector: string | null;
  healNote: string | null;
  healApplied: boolean;
}

function toPublicRun(doc: TestRunDoc, passed: number, failed: number): PublicRun {
  const finishedAt = doc.finishedAt;
  return {
    id: doc._id.toString(),
    trigger: doc.trigger,
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    finishedAt: finishedAt ? finishedAt.toISOString() : null,
    passed,
    failed,
    durationMs: finishedAt ? finishedAt.getTime() - doc.startedAt.getTime() : 0,
  };
}

export const listRunsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, testRuns, runResults } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const runs = await testRuns.find({ projectId: project._id }).sort({ startedAt: -1 }).toArray();

    const results = await runResults.find({ runId: { $in: runs.map((r) => r._id) } }).toArray();
    const byRun = new Map<string, RunResultDoc[]>();
    for (const result of results) {
      const key = result.runId.toString();
      byRun.set(key, [...(byRun.get(key) ?? []), result]);
    }

    return runs.map((run) => {
      const runResultsForRun = byRun.get(run._id.toString()) ?? [];
      const passed = runResultsForRun.filter((r) => r.status === "passed").length;
      const failed = runResultsForRun.filter((r) => r.status === "failed").length;
      return toPublicRun(run, passed, failed);
    });
  });

export const getRunDetailFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ runId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { testRuns, runResults, testCases, testScenarios } = collections(db);

    const run = await testRuns.findOne({ _id: new ObjectId(data.runId) });
    if (!run) throw new ForbiddenError("Run not found");
    await requireOrgMember(db, run.orgId, context.user._id);

    const results = await runResults.find({ runId: run._id }).toArray();
    const caseIds = results.map((r) => r.testCaseId);
    const cases = await testCases.find({ _id: { $in: caseIds } }).toArray();
    const casesById = new Map(cases.map((c) => [c._id.toString(), c]));

    const scenarioIds = cases.map((c) => c.scenarioId);
    const scenarios = await testScenarios.find({ _id: { $in: scenarioIds } }).toArray();
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    const publicResults: PublicRunResult[] = results.map((result) => {
      const testCase = casesById.get(result.testCaseId.toString());
      const scenario = testCase ? scenariosById.get(testCase.scenarioId.toString()) : undefined;
      return {
        id: result._id.toString(),
        testCaseId: result.testCaseId.toString(),
        scenarioTitle: scenario?.title ?? "Unknown scenario",
        filePath: scenario?.filePath ?? null,
        status: result.status,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
        healedSelector: result.healedSelector,
        healNote: result.healNote,
        healApplied: result.healApplied,
      };
    });

    const passed = publicResults.filter((r) => r.status === "passed").length;
    const failed = publicResults.filter((r) => r.status === "failed").length;

    return { run: toPublicRun(run, passed, failed), results: publicResults };
  });

// INTEGRATION POINT: stand-in for real Playwright execution. Simulates a
// pass/fail outcome per test case instead of actually running generated
// code against the target app. Swap the body of this loop for a real
// execution engine (e.g. a queue that runs test_cases.generated_code in a
// browser grid) without changing the calling pages — they only depend on
// test_runs/run_results existing afterward.
function simulateResultStatus(): "passed" | "failed" {
  return Math.random() < 0.82 ? "passed" : "failed";
}

const SIMULATED_ERROR =
  "Error: expected element to be visible within 5000ms — locator resolved to 0 elements.";

async function runTestCases(
  db: Awaited<ReturnType<typeof getDb>>,
  orgId: ObjectId,
  projectId: ObjectId,
  trigger: TestRunDoc["trigger"],
  testCaseIds: ObjectId[],
  // Self-healing fallback outcomes (see attemptSelfHeal below), keyed by
  // testCaseId string. Only rerunFailedFn populates this — a first-time
  // run has nothing to heal yet. Recording the heal attempt on the new
  // result row, independent of whether the (still-simulated) execution
  // happens to pass or fail this time, keeps the two concerns separate:
  // "did the agent propose a fix" vs. "did the test actually pass" —
  // exactly like the real Playwright execution engine will need to.
  healOutcomes: Map<string, HealResult> = new Map(),
): Promise<PublicRun> {
  const { testRuns, runResults, testCases } = collections(db);
  const startedAt = new Date();

  const runId = new ObjectId();
  await testRuns.insertOne({
    _id: runId,
    orgId,
    projectId,
    trigger,
    status: "running",
    startedAt,
    finishedAt: null,
  });

  const results = testCaseIds.map((testCaseId) => {
    const status = simulateResultStatus();
    const heal = healOutcomes.get(testCaseId.toString());
    return {
      _id: new ObjectId(),
      orgId,
      runId,
      testCaseId,
      status,
      durationMs: 800 + Math.floor(Math.random() * 4000),
      errorMessage: status === "failed" ? SIMULATED_ERROR : null,
      createdAt: new Date(),
      healedSelector: heal?.selector ?? null,
      healNote: heal ? `[${heal.confidence} confidence] ${heal.notes}` : null,
      healApplied: false,
    };
  });
  if (results.length > 0) await runResults.insertMany(results);

  await Promise.all(
    results.map((r) =>
      testCases.updateOne(
        { _id: r.testCaseId },
        { $set: { status: r.status === "passed" ? "passing" : "failing", updatedAt: new Date() } },
      ),
    ),
  );

  const failed = results.filter((r) => r.status === "failed").length;
  const finishedAt = new Date();
  const overallStatus: TestRunDoc["status"] =
    results.length === 0
      ? "passed"
      : failed === 0
        ? "passed"
        : failed === results.length
          ? "failed"
          : "flaky";

  await testRuns.updateOne({ _id: runId }, { $set: { status: overallStatus, finishedAt } });

  return toPublicRun(
    { _id: runId, orgId, projectId, trigger, status: overallStatus, startedAt, finishedAt },
    results.length - failed,
    failed,
  );
}

export const triggerRunFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const project = await collections(db).projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgWrite(db, project.orgId, context.user._id);

    const { testPlans, testScenarios, testCases } = collections(db);
    const testPlan = await testPlans.findOne({ projectId: project._id });
    const scenarios = testPlan
      ? await testScenarios.find({ testPlanId: testPlan._id, status: "accepted" }).toArray()
      : [];
    const cases = await testCases
      .find({ scenarioId: { $in: scenarios.map((s) => s._id) } })
      .toArray();

    return runTestCases(
      db,
      project.orgId,
      project._id,
      "manual",
      cases.map((c) => c._id),
    );
  });

// Self-healing fallback (see services/crawl-agent/app/heal.py): for each
// failed test case, hand its scenario description to the browser-use
// agent to re-locate a working selector on the live app, before
// re-running. Best-effort — a heal attempt that errors (agent unreachable,
// quota exhausted, no plausible match found) just means that case retries
// without a proposed fix, same as it always did. Only applies to "url"
// sourced projects: there's no live app to point the agent at for a
// GitHub-sourced project without also having run its dev server, which
// is out of scope here.
async function attemptSelfHeal(
  db: Awaited<ReturnType<typeof getDb>>,
  projectId: ObjectId,
  testCaseIds: ObjectId[],
): Promise<Map<string, HealResult>> {
  const outcomes = new Map<string, HealResult>();
  if (testCaseIds.length === 0) return outcomes;

  const { projects, testCases, testScenarios } = collections(db);
  const project = await projects.findOne({ _id: projectId });
  if (!project || project.sourceType !== "url") return outcomes;

  const cases = await testCases.find({ _id: { $in: testCaseIds } }).toArray();
  const scenarios = await testScenarios
    .find({ _id: { $in: cases.map((c) => c.scenarioId) } })
    .toArray();
  const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));

  await Promise.all(
    cases.map(async (testCase) => {
      const scenario = scenariosById.get(testCase.scenarioId.toString());
      if (!scenario) return;
      try {
        const result = await healLocatorFn({
          data: {
            url: project.sourceUrl,
            targetDescription: `${scenario.title}: ${scenario.description}`,
            previousSelector: null,
          },
        });
        outcomes.set(testCase._id.toString(), result);
      } catch {
        // Best-effort — see comment above. Nothing to do here; the case
        // just re-runs without a healedSelector/healNote attached.
      }
    }),
  );

  return outcomes;
}

export const rerunFailedFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ runId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { testRuns, runResults } = collections(db);

    const run = await testRuns.findOne({ _id: new ObjectId(data.runId) });
    if (!run) throw new ForbiddenError("Run not found");
    await requireOrgWrite(db, run.orgId, context.user._id);

    const failedResults = await runResults.find({ runId: run._id, status: "failed" }).toArray();
    const testCaseIds = failedResults.map((r) => r.testCaseId);

    const healOutcomes = await attemptSelfHeal(db, run.projectId, testCaseIds);

    return runTestCases(db, run.orgId, run.projectId, "manual", testCaseIds, healOutcomes);
  });
