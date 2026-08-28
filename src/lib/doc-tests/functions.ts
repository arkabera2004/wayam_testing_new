// Doc Tests — ported from aidlc_azure's DocTests page. Given pasted
// documentation text, drafts test scenarios via Gemini (grounded in the
// doc's actual stated requirements), falling back to a heuristic
// sentence-extraction pass (see heuristic.ts) if Gemini is unavailable —
// same "never block the feature" philosophy as
// src/lib/projects/scenario-generation.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { DocTestRunDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgWrite, requireOrgMember } from "@/lib/data/org-access.server";
import { buildDocPrompt, requestDocScenariosFromGemini } from "./gemini";
import {
  extractRequirements,
  requirementsToScenarios,
  type DocScenarioTemplate,
} from "./heuristic";

const MAX_DOC_EXCERPT = 4000;

export interface PublicDocTestRun {
  id: string;
  docTitle: string;
  docExcerpt: string;
  source: "gemini" | "heuristic";
  scenarios: DocScenarioTemplate[];
  createdAt: string;
}

function toPublicRun(doc: DocTestRunDoc): PublicDocTestRun {
  return {
    id: doc._id.toString(),
    docTitle: doc.docTitle,
    docExcerpt: doc.docExcerpt,
    source: doc.source,
    scenarios: doc.scenarios,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const generateDocTestsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      projectId: z.string(),
      docTitle: z.string().trim().max(200),
      docText: z.string().trim().min(20).max(30_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, docTestRuns } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgWrite(db, project.orgId, context.user._id);

    let scenarios: DocScenarioTemplate[];
    let source: "gemini" | "heuristic";
    try {
      scenarios = await requestDocScenariosFromGemini(buildDocPrompt(data.docTitle, data.docText));
      source = "gemini";
    } catch (err) {
      console.error(
        "[generateDocTestsFn] Gemini generation failed, falling back to heuristic:",
        err,
      );
      scenarios = requirementsToScenarios(extractRequirements(data.docText));
      source = "heuristic";
    }

    const doc: DocTestRunDoc = {
      _id: new ObjectId(),
      orgId: project.orgId,
      projectId: project._id,
      docTitle: data.docTitle || "Untitled document",
      docExcerpt: data.docText.slice(0, MAX_DOC_EXCERPT),
      scenarios,
      source,
      createdAt: new Date(),
    };
    await docTestRuns.insertOne(doc);

    return toPublicRun(doc);
  });

export const listDocTestRunsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, docTestRuns } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const runs = await docTestRuns
      .find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return runs.map(toPublicRun);
  });
