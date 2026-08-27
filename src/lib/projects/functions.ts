import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { ProjectDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";

export interface PublicProject {
  id: string;
  name: string;
  sourceType: "github" | "url";
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
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
    return docs.map(toPublicProject);
  });

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

    const { projects, testPlans } = collections(db);
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

    // INTEGRATION POINT: a real crawl + LLM test-plan generation pipeline
    // would populate test_scenarios here. For now this just creates the
    // empty test-plan shell the test-plan-view step reads from.
    await testPlans.insertOne({
      _id: new ObjectId(),
      orgId,
      projectId: project._id,
      createdAt: now,
      updatedAt: now,
    });

    return toPublicProject(project);
  });
