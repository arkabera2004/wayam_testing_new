// Synthetic Data — ported from aidlc_azure's SyntheticData page. Given an
// existing scenario, generates realistic JSON test records via Gemini
// (grounded in the scenario's own title/description), falling back to a
// heuristic field-guessing pass (see fallback.ts) when Gemini is
// unavailable — same philosophy as scenario-generation.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { JsonValue, SyntheticDataRunDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgWrite } from "@/lib/data/org-access.server";
import { buildSyntheticDataPrompt, requestSyntheticDataFromGemini } from "./gemini";
import { generateFallbackDataset } from "./fallback";

export interface PublicSyntheticDataRun {
  id: string;
  scenarioTitle: string;
  count: number;
  records: Array<Record<string, JsonValue>>;
  source: "gemini" | "heuristic";
  createdAt: string;
}

function toPublicRun(doc: SyntheticDataRunDoc): PublicSyntheticDataRun {
  return {
    id: doc._id.toString(),
    scenarioTitle: doc.scenarioTitle,
    count: doc.count,
    records: doc.records,
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const generateSyntheticDataFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ scenarioId: z.string(), count: z.number().int().min(1).max(20) }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const { testScenarios, syntheticDataRuns } = collections(db);

    const scenario = await testScenarios.findOne({ _id: new ObjectId(data.scenarioId) });
    if (!scenario) throw new ForbiddenError("Scenario not found");
    await requireOrgWrite(db, scenario.orgId, context.user._id);

    const scenarioText = `${scenario.title}. ${scenario.description}`;
    let records: Array<Record<string, JsonValue>>;
    let source: "gemini" | "heuristic";
    try {
      records = await requestSyntheticDataFromGemini(
        buildSyntheticDataPrompt(scenarioText, data.count),
      );
      source = "gemini";
    } catch (err) {
      console.error(
        "[generateSyntheticDataFn] Gemini generation failed, falling back to heuristic:",
        err,
      );
      records = generateFallbackDataset(scenarioText, data.count);
      source = "heuristic";
    }

    const doc: SyntheticDataRunDoc = {
      _id: new ObjectId(),
      orgId: scenario.orgId,
      scenarioId: scenario._id,
      scenarioTitle: scenario.title,
      count: data.count,
      records,
      source,
      createdAt: new Date(),
    };
    await syntheticDataRuns.insertOne(doc);

    return toPublicRun(doc);
  });
