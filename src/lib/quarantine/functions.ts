// Quarantine — pulls a flaky test case out of release-gate/CI-blocking
// consideration without deleting it (see TestCaseDoc.quarantined in
// schema.ts). setQuarantineFn is called from both the Analytics flaky
// leaderboard (quarantine a specific offender) and this dedicated
// org-wide Quarantine page (review/un-quarantine).
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";

export interface PublicQuarantinedCase {
  testCaseId: string;
  scenarioTitle: string;
  projectId: string;
  projectName: string;
  quarantinedAt: string | null;
}

export const listQuarantinedCasesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }): Promise<PublicQuarantinedCase[]> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const { testCases, testScenarios, testPlans, projects } = collections(db);
    const cases = await testCases
      .find({ orgId, quarantined: true })
      .sort({ quarantinedAt: -1 })
      .toArray();
    if (cases.length === 0) return [];

    const scenarios = await testScenarios
      .find({ _id: { $in: cases.map((c) => c.scenarioId) } })
      .toArray();
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    const plans = await testPlans
      .find({ _id: { $in: scenarios.map((s) => s.testPlanId) } })
      .toArray();
    const planById = new Map(plans.map((p) => [p._id.toString(), p]));

    const projectIds = [...new Set(plans.map((p) => p.projectId.toString()))].map(
      (id) => new ObjectId(id),
    );
    const orgProjects = await projects.find({ _id: { $in: projectIds } }).toArray();
    const projectById = new Map(orgProjects.map((p) => [p._id.toString(), p]));

    return cases.map((testCase) => {
      const scenario = scenariosById.get(testCase.scenarioId.toString());
      const plan = scenario ? planById.get(scenario.testPlanId.toString()) : undefined;
      const project = plan ? projectById.get(plan.projectId.toString()) : undefined;
      return {
        testCaseId: testCase._id.toString(),
        scenarioTitle: scenario?.title ?? "Unknown scenario",
        projectId: project?._id.toString() ?? "",
        projectName: project?.name ?? "Unknown project",
        quarantinedAt: testCase.quarantinedAt ? testCase.quarantinedAt.toISOString() : null,
      };
    });
  });

export const setQuarantineFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ testCaseId: z.string(), quarantined: z.boolean() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { testCases } = collections(db);

    const testCase = await testCases.findOne({ _id: new ObjectId(data.testCaseId) });
    if (!testCase) throw new ForbiddenError("Test case not found");
    await requireOrgWrite(db, testCase.orgId, context.user._id);

    await testCases.updateOne(
      { _id: testCase._id },
      {
        $set: {
          quarantined: data.quarantined,
          quarantinedAt: data.quarantined ? new Date() : null,
          updatedAt: new Date(),
        },
      },
    );

    return { ok: true, quarantined: data.quarantined };
  });
