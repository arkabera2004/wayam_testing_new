// Code Impact — ported from aidlc_azure's CodeImpact page. Given a project
// and a list of changed files, reports the blast radius per file: which
// accepted test cases cover it, and how risky that file is to touch based
// on the priority of what it's covered by. Not persisted (a live report,
// recomputed on demand) — pairs with Intelligent Test Selection, which
// answers "which tests to run" rather than "how risky is this file."
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember } from "@/lib/data/org-access.server";
import { analyzeCodeImpact, type CodeImpactSummary } from "./analyze";

export const analyzeCodeImpactFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      projectId: z.string(),
      changedFiles: z.string().max(20_000),
    }),
  )
  .handler(async ({ context, data }): Promise<CodeImpactSummary> => {
    const db = await getDb();
    const { projects, testPlans, testScenarios, testCases } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const testPlan = await testPlans.findOne({ projectId: project._id });
    const scenarios = testPlan
      ? await testScenarios.find({ testPlanId: testPlan._id, status: "accepted" }).toArray()
      : [];
    const cases = await testCases
      .find({ scenarioId: { $in: scenarios.map((s) => s._id) } })
      .toArray();
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    const changedFiles = data.changedFiles.split(/[\n,]/).filter((f) => f.trim());

    return analyzeCodeImpact(
      changedFiles,
      cases.map((c) => {
        const scenario = scenariosById.get(c.scenarioId.toString());
        return {
          testCaseId: c._id.toString(),
          scenarioTitle: scenario?.title ?? "Unknown scenario",
          scenarioType: scenario?.type ?? "E2E",
          priority: scenario?.priority ?? "medium",
          filePath: scenario?.filePath ?? null,
        };
      }),
    );
  });
