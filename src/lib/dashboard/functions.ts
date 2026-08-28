import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { RunResultDoc, RunStatus, RunTrigger } from "@/integrations/mongodb/schema";
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

export interface DashboardRecentRun {
  id: string;
  projectId: string;
  projectName: string;
  status: RunStatus;
  trigger: RunTrigger;
  startedAt: string;
}

export interface DashboardData {
  totals: {
    projects: number;
    testsGenerated: number;
    flakyTests: number;
    runsLast7Days: number;
    integrationsConnected: number;
  };
  avgCoveragePct: number;
  trend: TrendPoint[];
  recentProjects: DashboardProjectSummary[];
  recentRuns: DashboardRecentRun[];
}

const RECENT_RUNS_LIMIT = 6;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Same "status flipped across its last 14 results" rule as the analytics
 * page's flaky-test leaderboard — this just needs the count, not the
 * per-test detail. Quarantined cases are excluded: they're already being
 * handled (see /quarantine), so they shouldn't keep inflating the
 * headline "needs attention" number. */
function countFlakyTestCases(
  results: Array<Pick<RunResultDoc, "testCaseId" | "status" | "createdAt">>,
  quarantinedCaseIds: Set<string>,
): number {
  const resultsByCase = new Map<string, typeof results>();
  for (const result of results) {
    const key = result.testCaseId.toString();
    if (quarantinedCaseIds.has(key)) continue;
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

    const { projects, testCases, runResults, testRuns, integrations } = collections(db);
    const [orgProjects, cases, results, runs, orgIntegrations] = await Promise.all([
      projects.find({ orgId }).sort({ updatedAt: -1 }).toArray(),
      testCases.find({ orgId }).toArray(),
      runResults.find({ orgId }).toArray(),
      testRuns.find({ orgId }).sort({ startedAt: -1 }).toArray(),
      integrations.find({ orgId }).toArray(),
    ]);

    const statuses = await getProjectStatuses(
      db,
      orgId,
      orgProjects.map((p) => p._id),
    );

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
        ...(statuses.get(p._id.toString()) ?? {
          coveragePct: 0,
          lastRunStatus: "not_run" as const,
        }),
      }));

    const projectNameById = new Map(orgProjects.map((p) => [p._id.toString(), p.name]));
    const recentRuns: DashboardRecentRun[] = runs.slice(0, RECENT_RUNS_LIMIT).map((run) => ({
      id: run._id.toString(),
      projectId: run.projectId.toString(),
      projectName: projectNameById.get(run.projectId.toString()) ?? "Unknown project",
      status: run.status,
      trigger: run.trigger,
      startedAt: run.startedAt.toISOString(),
    }));

    const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;
    const runsLast7Days = runs.filter((r) => r.startedAt.getTime() >= sevenDaysAgo).length;

    return {
      totals: {
        projects: orgProjects.length,
        testsGenerated: cases.length,
        flakyTests: countFlakyTestCases(
          results,
          new Set(cases.filter((c) => c.quarantined).map((c) => c._id.toString())),
        ),
        runsLast7Days,
        integrationsConnected: orgIntegrations.filter((i) => i.status === "connected").length,
      },
      avgCoveragePct,
      trend: computeWeeklyTrend(results),
      recentProjects,
      recentRuns,
    };
  });
