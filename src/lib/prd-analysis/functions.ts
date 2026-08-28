// PRD Analysis — given pasted requirements-document text, extracts and
// classifies every requirement, flags what can't be tested as written
// (vague wording, missing thresholds, duplicates), and drafts a traced
// test case per testable requirement via Gemini, falling back to the
// heuristic pass in heuristic.ts when Gemini is unavailable — same
// never-block-the-feature philosophy as
// src/lib/projects/scenario-generation.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { PrdAnalysisDoc, TestScenarioDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgWrite, requireOrgMember } from "@/lib/data/org-access.server";
import { buildPrdPrompt, requestPrdAnalysisFromGemini } from "./gemini";
import { classifyRequirements, draftTestCases, splitRequirements } from "./heuristic";

const MAX_DOC_EXCERPT = 6000;

export interface PublicPrdAnalysis {
  id: string;
  projectId: string;
  docTitle: string;
  docExcerpt: string;
  source: "gemini" | "heuristic";
  requirements: PrdAnalysisDoc["requirements"];
  testCases: PrdAnalysisDoc["testCases"];
  stats: {
    requirements: number;
    testable: number;
    casesProposed: number;
    ambiguities: number;
    coveragePct: number;
  };
  createdAt: string;
}

function toPublicAnalysis(doc: PrdAnalysisDoc): PublicPrdAnalysis {
  const covered = doc.requirements.filter((r) => r.coverage === "covered").length;
  const testable = doc.requirements.filter((r) => r.coverage !== "gap").length;
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    docTitle: doc.docTitle,
    docExcerpt: doc.docExcerpt,
    source: doc.source,
    requirements: doc.requirements,
    testCases: doc.testCases,
    stats: {
      requirements: doc.requirements.length,
      testable,
      casesProposed: doc.testCases.length,
      ambiguities: doc.requirements.length - covered,
      coveragePct: doc.requirements.length
        ? Math.round((covered / doc.requirements.length) * 100)
        : 0,
    },
    createdAt: doc.createdAt.toISOString(),
  };
}

export const analyzePrdFn = createServerFn({ method: "POST" })
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
    const { projects, prdAnalyses } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgWrite(db, project.orgId, context.user._id);

    let requirements: PrdAnalysisDoc["requirements"];
    let testCases: PrdAnalysisDoc["testCases"];
    let source: "gemini" | "heuristic";
    try {
      const result = await requestPrdAnalysisFromGemini(
        buildPrdPrompt(data.docTitle, data.docText),
      );
      requirements = result.requirements;
      testCases = result.testCases;
      source = "gemini";
    } catch (err) {
      console.error("[analyzePrdFn] Gemini analysis failed, falling back to heuristic:", err);
      requirements = classifyRequirements(splitRequirements(data.docText));
      testCases = draftTestCases(requirements);
      source = "heuristic";
    }

    const doc: PrdAnalysisDoc = {
      _id: new ObjectId(),
      orgId: project.orgId,
      projectId: project._id,
      docTitle: data.docTitle || "Untitled document",
      docExcerpt: data.docText.slice(0, MAX_DOC_EXCERPT),
      requirements,
      testCases,
      source,
      createdAt: new Date(),
    };
    await prdAnalyses.insertOne(doc);

    return toPublicAnalysis(doc);
  });

export const listPrdAnalysesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { projects, prdAnalyses } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const runs = await prdAnalyses
      .find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return runs.map(toPublicAnalysis);
  });

/** Turns every testable-requirement case in a PRD analysis into a real,
 * already-accepted scenario on the project's test plan — the same
 * test_scenarios documents the normal review flow produces, just marked
 * accepted immediately since a human explicitly chose to add them here.
 * From there they go through the exact same "Generate code" / run
 * pipeline as any other scenario. */
export const addPrdCasesToTestPlanFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ prdAnalysisId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { prdAnalyses, projects, testPlans, testScenarios } = collections(db);

    const analysis = await prdAnalyses.findOne({ _id: new ObjectId(data.prdAnalysisId) });
    if (!analysis) throw new ForbiddenError("PRD analysis not found");
    await requireOrgWrite(db, analysis.orgId, context.user._id);

    const project = await projects.findOne({ _id: analysis.projectId });
    if (!project) throw new ForbiddenError("Project not found");

    let testPlan = await testPlans.findOne({ projectId: project._id });
    const now = new Date();
    if (!testPlan) {
      testPlan = {
        _id: new ObjectId(),
        orgId: analysis.orgId,
        projectId: project._id,
        createdAt: now,
        updatedAt: now,
      };
      await testPlans.insertOne(testPlan);
    }

    const scenarioDocs: TestScenarioDoc[] = analysis.testCases.map((tc) => ({
      _id: new ObjectId(),
      orgId: analysis.orgId,
      testPlanId: testPlan!._id,
      type: tc.type,
      title: tc.title,
      description: `${tc.description} (${tc.tag.replace("-", " ")})`,
      status: "accepted",
      priority: tc.priority,
      filePath: tc.filePath,
      createdAt: now,
      updatedAt: now,
    }));
    if (scenarioDocs.length > 0) await testScenarios.insertMany(scenarioDocs);

    return { addedCount: scenarioDocs.length };
  });
