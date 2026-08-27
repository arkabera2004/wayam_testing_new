import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { RunResultDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgMember } from "@/lib/data/org-access.server";
import { getProjectStatuses, type ProjectStatus } from "@/lib/data/project-status.server";
import { computeWeeklyTrend, type TrendPoint } from "@/lib/analytics/trend.server";

const RECENT_RESULTS_PER_CASE = 14;
const RECENT_PROJECTS_LIMIT = 3;

export interface DashboardProjectSummary extends ProjectStatus {
  id: string;
  name: string;
}

export interface DashboardData {
  totals: {
    projects: number;
    testsGenerated: number;
    flakyTests: number;
  };
  avgCoveragePct: number;
  trend: TrendPoint[];
  recentProjects: DashboardProjectSummary[];
}

/** Same "status flipped across its last 14 results" rule as the analytics
 * page's flaky-test leaderboard — this just needs the count, not the
 * per-test detail. */
function countFlakyTestCases(results: Array<Pick<RunResultDoc, "testCaseId" | "status" | "createdAt">>): number {
  const resultsByCase = new Map<string, typeof results>();
  for (const result of results) {
    const key = result.testCaseId.toString();
    resultsByCase.set(key, [...(resultsByCase.get(key) ?? []), result]);
  }

  let flakyCount = 0;
  for (const caseResults of resultsByCase.values()) {
    const recent = [...caseResults]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-RECENT_RESULTS_PER_CASE);
    for (let i = 1; i < recent.length; i++) {
      if (recent[i]!.status !== recent[i - 1]!.status) {
        flakyCount += 1;
        break;
      }
    }
  }
  return flakyCount;
}

export const getDashboardFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }): Promise<DashboardData> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const { projects, testCases, runResults } = collections(db);
    const [orgProjects, cases, results] = await Promise.all([
      projects.find({ orgId }).sort({ updatedAt: -1 }).toArray(),
      testCases.find({ orgId }).toArray(),
      runResults.find({ orgId }).toArray(),
    ]);

    const statuses = await getProjectStatuses(db, orgId, orgProjects.map((p) => p._id));

    const avgCoveragePct = orgProjects.length
      ? Math.round(
          orgProjects.reduce(
            (sum, p) => sum + (statuses.get(p._id.toString())?.coveragePct ?? 0),
            0,
          ) / orgProjects.length,
        )
      : 0;

    const recentProjects: DashboardProjectSummary[] = orgProjects
      .slice(0, RECENT_PROJECTS_LIMIT)
      .map((p) => ({
        id: p._id.toString(),
        name: p.name,
        ...(statuses.get(p._id.toString()) ?? { coveragePct: 0, lastRunStatus: "not_run" as const }),
      }));

    return {
      totals: {
        projects: orgProjects.length,
        testsGenerated: cases.length,
        flakyTests: countFlakyTestCases(results),
      },
      avgCoveragePct,
      trend: computeWeeklyTrend(results),
      recentProjects,
    };
  });
