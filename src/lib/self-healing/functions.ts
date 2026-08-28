// Self-Healing — a dedicated, org-wide view over heal suggestions that
// already exist per-run (see src/lib/runs/functions.ts's attemptSelfHeal
// and services/crawl-agent/app/heal.py), rather than a new data source:
// every failed result with a healedSelector is a heal suggestion, whether
// or not anyone's looked at it on that specific run's page yet.
//
// "Apply fix" stays human-in-the-loop by design (see the schema.ts comment
// on RunResultDoc.healApplied): it doesn't blindly string-replace a
// selector in generatedCode, since the current code generator is itself a
// stub (see src/lib/cases/functions.ts) with no guaranteed selector to
// find and replace. It appends a clearly marked, reviewable annotation
// instead — a real edit to real code, just not a fabricated "found X,
// replaced with Y" claim this app can't actually back up yet.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";

const RECENT_HEALS_LIMIT = 30;

export interface PublicHealSuggestion {
  runResultId: string;
  runId: string;
  projectId: string;
  projectName: string;
  scenarioTitle: string;
  healedSelector: string;
  healNote: string | null;
  applied: boolean;
  createdAt: string;
}

export const listRecentHealsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }): Promise<PublicHealSuggestion[]> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const { runResults, testRuns, projects, testCases, testScenarios } = collections(db);

    const heals = await runResults
      .find({ orgId, healedSelector: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(RECENT_HEALS_LIMIT)
      .toArray();
    if (heals.length === 0) return [];

    const [runs, cases] = await Promise.all([
      testRuns.find({ _id: { $in: heals.map((h) => h.runId) } }).toArray(),
      testCases.find({ _id: { $in: heals.map((h) => h.testCaseId) } }).toArray(),
    ]);
    const runsById = new Map(runs.map((r) => [r._id.toString(), r]));
    const casesById = new Map(cases.map((c) => [c._id.toString(), c]));

    const scenarios = await testScenarios
      .find({ _id: { $in: cases.map((c) => c.scenarioId) } })
      .toArray();
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    const projectIds = [...new Set(runs.map((r) => r.projectId.toString()))].map(
      (id) => new ObjectId(id),
    );
    const orgProjects = await projects.find({ _id: { $in: projectIds } }).toArray();
    const projectNameById = new Map(orgProjects.map((p) => [p._id.toString(), p.name]));

    return heals
      .map((heal) => {
        const run = runsById.get(heal.runId.toString());
        const testCase = casesById.get(heal.testCaseId.toString());
        const scenario = testCase ? scenariosById.get(testCase.scenarioId.toString()) : undefined;
        if (!run || !heal.healedSelector) return null;
        return {
          runResultId: heal._id.toString(),
          runId: heal.runId.toString(),
          projectId: run.projectId.toString(),
          projectName: projectNameById.get(run.projectId.toString()) ?? "Unknown project",
          scenarioTitle: scenario?.title ?? "Unknown scenario",
          healedSelector: heal.healedSelector,
          healNote: heal.healNote,
          applied: heal.healApplied,
          createdAt: heal.createdAt.toISOString(),
        } satisfies PublicHealSuggestion;
      })
      .filter((h): h is PublicHealSuggestion => h !== null);
  });

export const applyHealFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ runResultId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { runResults, testCases } = collections(db);

    const heal = await runResults.findOne({ _id: new ObjectId(data.runResultId) });
    if (!heal || !heal.healedSelector) throw new ForbiddenError("Heal suggestion not found");
    await requireOrgWrite(db, heal.orgId, context.user._id);
    if (heal.healApplied) return { ok: true, alreadyApplied: true };

    const testCase = await testCases.findOne({ _id: heal.testCaseId });
    if (!testCase) throw new ForbiddenError("Test case not found");

    const annotation = `\n// [Self-healing, applied ${new Date().toISOString().slice(0, 10)}] Parikshan proposed this replacement selector after a locator broke:\n// ${heal.healedSelector}\n${heal.healNote ? `// ${heal.healNote}\n` : ""}`;

    await Promise.all([
      testCases.updateOne(
        { _id: testCase._id },
        { $set: { generatedCode: testCase.generatedCode + annotation, updatedAt: new Date() } },
      ),
      runResults.updateOne({ _id: heal._id }, { $set: { healApplied: true } }),
    ]);

    return { ok: true, alreadyApplied: false };
  });
