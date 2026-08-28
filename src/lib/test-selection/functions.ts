// Intelligent Test Selection — ported from aidlc_azure's TestSelection
// page/test_selection_service.py. Given a project and a list of changed
// file paths, ranks its accepted test cases by relevance (see
// ./scoring.ts) instead of requiring a full-suite run on every change.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { TestSelectionRunDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";
import { scoreTestSelection } from "./scoring";

export interface PublicTestSelectionRun {
  id: string;
  projectId: string;
  changedFiles: string[];
  diffAvailable: boolean;
  totalTests: number;
  selectedTests: number;
  skippedTests: number;
  estimatedSavingsPct: number;
  candidates: Array<{
    testCaseId: string;
    scenarioTitle: string;
    scenarioType: string;
    filePath: string | null;
    priority: string;
    score: number;
    selected: boolean;
    reasons: Array<{ label: string; matched: boolean }>;
  }>;
  createdAt: string;
}

function toPublicRun(doc: TestSelectionRunDoc): PublicTestSelectionRun {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    changedFiles: doc.changedFiles,
    diffAvailable: doc.diffAvailable,
    totalTests: doc.totalTests,
    selectedTests: doc.selectedTests,
    skippedTests: doc.skippedTests,
    estimatedSavingsPct: doc.estimatedSavingsPct,
    candidates: doc.candidates.map((c) => ({
      testCaseId: c.testCaseId.toString(),
      scenarioTitle: c.scenarioTitle,
      scenarioType: c.scenarioType,
      filePath: c.filePath,
      priority: c.priority,
      score: c.score,
      selected: c.selected,
      reasons: c.reasons,
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const analyzeTestSelectionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      projectId: z.string(),
      // Newline- or comma-separated list of changed file paths, as pasted
      // from `git diff --name-only`. Empty means "no diff available".
      changedFiles: z.string().max(20_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, testPlans, testScenarios, testCases, testSelectionRuns } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgWrite(db, project.orgId, context.user._id);

    const testPlan = await testPlans.findOne({ projectId: project._id });
    const scenarios = testPlan
      ? await testScenarios.find({ testPlanId: testPlan._id, status: "accepted" }).toArray()
      : [];
    const cases = await testCases
      .find({ scenarioId: { $in: scenarios.map((s) => s._id) } })
      .toArray();
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    const changedFiles = data.changedFiles
      .split(/[\n,]/)
      .map((f) => f.trim())
      .filter(Boolean);

    const scored = scoreTestSelection(
      cases.map((c) => {
        const scenario = scenariosById.get(c.scenarioId.toString());
        return {
          testCaseId: c._id.toString(),
          scenarioTitle: scenario?.title ?? "",
          filePath: scenario?.filePath ?? null,
        };
      }),
      changedFiles,
    );
    const scoredById = new Map(scored.map((s) => [s.testCaseId, s]));

    const candidates = cases.map((c) => {
      const scenario = scenariosById.get(c.scenarioId.toString());
      const result = scoredById.get(c._id.toString())!;
      return {
        testCaseId: c._id,
        scenarioTitle: scenario?.title ?? "Unknown scenario",
        scenarioType: scenario?.type ?? "E2E",
        filePath: scenario?.filePath ?? null,
        priority: scenario?.priority ?? "medium",
        score: result.score,
        selected: result.selected,
        reasons: result.reasons,
      } satisfies TestSelectionRunDoc["candidates"][number];
    });

    const selectedTests = candidates.filter((c) => c.selected).length;
    const totalTests = candidates.length;

    const doc: TestSelectionRunDoc = {
      _id: new ObjectId(),
      orgId: project.orgId,
      projectId: project._id,
      changedFiles,
      diffAvailable: changedFiles.length > 0,
      totalTests,
      selectedTests,
      skippedTests: totalTests - selectedTests,
      estimatedSavingsPct:
        totalTests === 0 ? 0 : Math.round((1 - selectedTests / totalTests) * 100),
      candidates,
      createdAt: new Date(),
    };
    await testSelectionRuns.insertOne(doc);

    return toPublicRun(doc);
  });

export const listTestSelectionRunsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, testSelectionRuns } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const runs = await testSelectionRuns
      .find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return runs.map(toPublicRun);
  });
