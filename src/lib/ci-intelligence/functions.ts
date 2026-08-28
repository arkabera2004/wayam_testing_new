// CI Intelligence — ported from aidlc_azure's CIIntelligence page. Reports
// pass rate/duration trends across an org's test runs, broken down by
// trigger, plus the slowest test cases. Reads existing test_runs/run_results
// (real data already in this app) rather than a separate CI provider fetch.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgMember } from "@/lib/data/org-access.server";
import { computeWeeklyTrend, type TrendPoint } from "@/lib/analytics/trend.server";
import { computeCiIntelligence, type CiIntelligenceSummary } from "./aggregate";

export interface PublicCiIntelligence extends CiIntelligenceSummary {
  trend: TrendPoint[];
}

export const getCiIntelligenceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }): Promise<PublicCiIntelligence> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const { testRuns, runResults, testCases, testScenarios } = collections(db);
    const [runs, results, cases, scenarios] = await Promise.all([
      testRuns.find({ orgId }).toArray(),
      runResults.find({ orgId }).toArray(),
      testCases.find({ orgId }).toArray(),
      testScenarios.find({ orgId }).toArray(),
    ]);

    const scenarioTitleByCaseId = new Map<string, string>();
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));
    for (const testCase of cases) {
      const scenario = scenariosById.get(testCase.scenarioId.toString());
      scenarioTitleByCaseId.set(testCase._id.toString(), scenario?.title ?? "Unknown scenario");
    }

    const summary = computeCiIntelligence(
      runs.map((r) => ({
        trigger: r.trigger,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
      })),
      results.map((r) => ({
        testCaseId: r.testCaseId.toString(),
        scenarioTitle: scenarioTitleByCaseId.get(r.testCaseId.toString()) ?? "Unknown scenario",
        status: r.status,
        durationMs: r.durationMs,
      })),
    );

    return { ...summary, trend: computeWeeklyTrend(results) };
  });
