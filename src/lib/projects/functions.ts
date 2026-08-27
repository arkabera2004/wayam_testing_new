import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { ProjectDoc, TestScenarioDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";
import { getProjectStatuses, type ProjectStatus } from "@/lib/data/project-status.server";

export interface PublicProject extends ProjectStatus {
  id: string;
  name: string;
  sourceType: "github" | "url";
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
}

function toPublicProject(doc: ProjectDoc, status: ProjectStatus): PublicProject {
  return {
    id: doc._id.toString(),
    name: doc.name,
    sourceType: doc.sourceType,
    sourceUrl: doc.sourceUrl,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    ...status,
  };
}

export const listProjectsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const docs = await collections(db)
      .projects.find({ orgId })
      .sort({ updatedAt: -1 })
      .toArray();
    const statuses = await getProjectStatuses(db, orgId, docs.map((d) => d._id));
    return docs.map((doc) =>
      toPublicProject(doc, statuses.get(doc._id.toString()) ?? { coveragePct: 0, lastRunStatus: "not_run" }),
    );
  });

// INTEGRATION POINT: stand-in for a real crawl + LLM test-plan generation
// pipeline. These generic starter scenarios exist so a freshly created
// project has something real to review (accept/edit/reject) immediately —
// swap this for the real pipeline without changing anything downstream,
// since it still just inserts test_scenarios documents.
function starterScenarios(orgId: ObjectId, testPlanId: ObjectId): TestScenarioDoc[] {
  const now = new Date();
  const templates: Array<
    Pick<TestScenarioDoc, "type" | "title" | "description" | "priority" | "filePath">
  > = [
    {
      type: "E2E",
      title: "Primary user flow completes without errors",
      description:
        "A first-time visitor completes the app's main flow end to end and reaches a confirmation state.",
      priority: "critical",
      filePath: "tests/e2e/primary-flow.spec.ts",
    },
    {
      type: "API",
      title: "Core endpoint rejects invalid input",
      description:
        "The primary write endpoint returns a 4xx with a machine-readable error instead of creating a malformed record.",
      priority: "high",
      filePath: "tests/api/core-endpoint-validation.spec.ts",
    },
    {
      type: "Regression",
      title: "Previously reported issue does not reoccur",
      description:
        "A placeholder regression guard — replace with the specific bug this project has already fixed once.",
      priority: "medium",
      filePath: "tests/regression/placeholder.spec.ts",
    },
    {
      type: "Accessibility",
      title: "Primary flow is fully keyboard navigable",
      description:
        "Every control in the main flow is reachable by keyboard with visible focus, and errors are announced to screen readers.",
      priority: "medium",
      filePath: "tests/a11y/primary-flow-keyboard.spec.ts",
    },
    {
      type: "Visual",
      title: "Key layout holds at tablet width",
      description: "Snapshot of the main page at 834px wide must not shift between runs.",
      priority: "low",
      filePath: "tests/visual/key-layout.spec.ts",
    },
  ];

  return templates.map((template) => ({
    _id: new ObjectId(),
    orgId,
    testPlanId,
    status: "proposed",
    createdAt: now,
    updatedAt: now,
    ...template,
  }));
}

export const createProjectFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      name: z.string().trim().min(1).max(200),
      sourceType: z.enum(["github", "url"]),
      sourceUrl: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgWrite(db, orgId, context.user._id);

    const { projects, testPlans, testScenarios } = collections(db);
    const now = new Date();
    const project: ProjectDoc = {
      _id: new ObjectId(),
      orgId,
      name: data.name,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl,
      createdAt: now,
      updatedAt: now,
    };
    await projects.insertOne(project);

    const testPlanId = new ObjectId();
    await testPlans.insertOne({
      _id: testPlanId,
      orgId,
      projectId: project._id,
      createdAt: now,
      updatedAt: now,
    });
    await testScenarios.insertMany(starterScenarios(orgId, testPlanId));

    // A brand-new project has no scenarios or runs yet.
    return toPublicProject(project, { coveragePct: 0, lastRunStatus: "not_run" });
  });
