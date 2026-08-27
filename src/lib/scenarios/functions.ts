import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { ProjectDoc, TestScenarioDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";
import type { PublicProject } from "@/lib/projects/functions";

export interface PublicScenario {
  id: string;
  projectId: string;
  type: TestScenarioDoc["type"];
  title: string;
  description: string;
  status: TestScenarioDoc["status"];
  priority: TestScenarioDoc["priority"];
  filePath: string | null;
}

function toPublicProject(doc: ProjectDoc): PublicProject {
  return {
    id: doc._id.toString(),
    name: doc.name,
    sourceType: doc.sourceType,
    sourceUrl: doc.sourceUrl,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toPublicScenario(doc: TestScenarioDoc, projectId: string): PublicScenario {
  return {
    id: doc._id.toString(),
    projectId,
    type: doc.type,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    priority: doc.priority,
    filePath: doc.filePath,
  };
}

/** Loads a project's test plan and scenarios in one round trip — the data
 * the test-plan-view page needs. Throws (via requireOrgMember) if the
 * caller isn't in the project's org. */
export const getProjectTestPlanFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, testPlans, testScenarios } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const testPlan = await testPlans.findOne({ projectId: project._id });
    const scenarios = testPlan
      ? await testScenarios.find({ testPlanId: testPlan._id }).sort({ createdAt: 1 }).toArray()
      : [];

    return {
      project: toPublicProject(project),
      scenarios: scenarios.map((s) => toPublicScenario(s, project._id.toString())),
    };
  });

async function loadScenarioForWrite(db: Awaited<ReturnType<typeof getDb>>, scenarioId: string, userId: ObjectId) {
  const scenario = await collections(db).testScenarios.findOne({ _id: new ObjectId(scenarioId) });
  if (!scenario) throw new ForbiddenError("Scenario not found");
  await requireOrgWrite(db, scenario.orgId, userId);
  return scenario;
}

export const updateScenarioStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      scenarioId: z.string(),
      status: z.enum(["proposed", "accepted", "rejected"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const scenario = await loadScenarioForWrite(db, data.scenarioId, context.user._id);

    await collections(db).testScenarios.updateOne(
      { _id: scenario._id },
      { $set: { status: data.status, updatedAt: new Date() } },
    );

    return { id: scenario._id.toString(), status: data.status };
  });

export const updateScenarioDescriptionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ scenarioId: z.string(), description: z.string().trim().min(1).max(2000) }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const scenario = await loadScenarioForWrite(db, data.scenarioId, context.user._id);

    await collections(db).testScenarios.updateOne(
      { _id: scenario._id },
      { $set: { description: data.description, updatedAt: new Date() } },
    );

    return { ok: true };
  });
