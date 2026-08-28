import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { ScenarioType } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgMember } from "@/lib/data/org-access.server";
import { computeWeeklyTrend } from "./trend.server";

export interface CoverageByType {
  type: ScenarioType;
  coverage: number;
  risk: number;
}

export interface FlakyTest {
  testCaseId: string;
  scenarioTitle: string;
  projectName: string;
  flips: number;
  rate: number;
  quarantined: boolean;
}

const TYPE_ORDER: ScenarioType[] = ["E2E", "API", "Regression", "Accessibility", "Visual"];
const RECENT_RESULTS_PER_CASE = 14;

export const getOrgAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const { testScenarios, testCases, runResults, testPlans, projects, testRuns } = collections(db);

    const [scenarios, cases, results, plans, orgProjects, runs] = await Promise.all([
      testScenarios.find({ orgId }).toArray(),
      testCases.find({ orgId }).toArray(),
      runResults.find({ orgId }).toArray(),
      testPlans.find({ orgId }).toArray(),
      projects.find({ orgId }).toArray(),
      testRuns.find({ orgId }).toArray(),
    ]);

    const projectNameByPlanId = new Map<string, string>();
    const projectById = new Map(orgProjects.map((p) => [p._id.toString(), p]));
    for (const plan of plans) {
      const project = projectById.get(plan.projectId.toString());
      if (project) projectNameByPlanId.set(plan._id.toString(), project.name);
    }
    const scenariosById = new Map(scenarios.map((s) => [s._id.toString(), s]));
    const casesById = new Map(cases.map((c) => [c._id.toString(), c]));

    // --- Coverage & risk by scenario type ---
    const coverageByType: CoverageByType[] = TYPE_ORDER.map((type) => {
      const typeScenarios = scenarios.filter((s) => s.type === type);
      const accepted = typeScenarios.filter((s) => s.status === "accepted").length;
      const coverage = typeScenarios.length
        ? Math.round((accepted / typeScenarios.length) * 100)
        : 0;

      const typeScenarioIds = new Set(typeScenarios.map((s) => s._id.toString()));
      const typeCaseIds = new Set(
        cases
          .filter((c) => typeScenarioIds.has(c.scenarioId.toString()))
          .map((c) => c._id.toString()),
      );
      const typeResults = results.filter((r) => typeCaseIds.has(r.testCaseId.toString()));
      const passRate = typeResults.length
        ? Math.round(
            (typeResults.filter((r) => r.status === "passed").length / typeResults.length) * 100,
          )
        : null;

      const risk = Math.max(
        0,
        Math.min(100, Math.round(100 - (coverage * 0.5 + (passRate ?? coverage) * 0.5))),
      );

      return { type, coverage, risk };
    }).filter((row) => scenarios.some((s) => s.type === row.type));

    // --- Pass/fail trend, last 7 days ---
    const trend = computeWeeklyTrend(results);

    // --- Flaky-test leaderboard ---
    const resultsByCase = new Map<string, typeof results>();
    for (const result of results) {
      const key = result.testCaseId.toString();
      resultsByCase.set(key, [...(resultsByCase.get(key) ?? []), result]);
    }

    const flakyTests: FlakyTest[] = [];
    for (const [caseId, caseResults] of resultsByCase) {
      const recent = [...caseResults]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-RECENT_RESULTS_PER_CASE);
      let flips = 0;
      for (let i = 1; i < recent.length; i++) {
        if (recent[i]!.status !== recent[i - 1]!.status) flips += 1;
      }
      if (flips === 0) continue;

      const testCase = casesById.get(caseId);
      const scenario = testCase ? scenariosById.get(testCase.scenarioId.toString()) : undefined;
      const projectName = scenario
        ? (projectNameByPlanId.get(scenario.testPlanId.toString()) ?? "Unknown project")
        : "Unknown project";
      const failed = recent.filter((r) => r.status === "failed").length;

      flakyTests.push({
        testCaseId: caseId,
        scenarioTitle: scenario?.title ?? "Unknown scenario",
        projectName,
        flips,
        rate: Math.round((failed / recent.length) * 100),
        quarantined: testCase?.quarantined ?? false,
      });
    }
    flakyTests.sort((a, b) => b.flips - a.flips);

    return {
      coverageByType,
      trend,
      flakyTests: flakyTests.slice(0, 10),
      totals: {
        projects: orgProjects.length,
        scenarios: scenarios.length,
        runs: runs.length,
      },
    };
  });
