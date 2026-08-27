import type { Db, ObjectId } from "mongodb";

import { collections } from "@/integrations/mongodb/collections.server";
import type { RunStatus } from "@/integrations/mongodb/schema";

export interface ProjectStatus {
  coveragePct: number;
  lastRunStatus: RunStatus | "not_run";
}

/** Per-project "how healthy is this project" snapshot: coverage % (accepted
 * scenarios / total scenarios on its test plan) and the status of its most
 * recent test run. Shared by the projects list and the dashboard so both
 * report the same numbers for the same project. */
export async function getProjectStatuses(
  db: Db,
  orgId: ObjectId,
  projectIds: ObjectId[],
): Promise<Map<string, ProjectStatus>> {
  if (projectIds.length === 0) return new Map();

  const { testPlans, testScenarios, testRuns } = collections(db);
  const [plans, runs] = await Promise.all([
    testPlans.find({ orgId, projectId: { $in: projectIds } }).toArray(),
    testRuns.find({ orgId, projectId: { $in: projectIds } }).sort({ startedAt: -1 }).toArray(),
  ]);

  const planIdByProjectId = new Map(plans.map((p) => [p.projectId.toString(), p._id]));
  const scenarios = await testScenarios
    .find({ orgId, testPlanId: { $in: plans.map((p) => p._id) } })
    .toArray();

  // First match per project wins — runs are sorted newest-first.
  const lastRunStatusByProject = new Map<string, RunStatus>();
  for (const run of runs) {
    const key = run.projectId.toString();
    if (!lastRunStatusByProject.has(key)) lastRunStatusByProject.set(key, run.status);
  }

  const result = new Map<string, ProjectStatus>();
  for (const projectId of projectIds) {
    const key = projectId.toString();
    const planId = planIdByProjectId.get(key);
    const planScenarios = planId
      ? scenarios.filter((s) => s.testPlanId.toString() === planId.toString())
      : [];
    const accepted = planScenarios.filter((s) => s.status === "accepted").length;
    const coveragePct = planScenarios.length
      ? Math.round((accepted / planScenarios.length) * 100)
      : 0;

    result.set(key, {
      coveragePct,
      lastRunStatus: lastRunStatusByProject.get(key) ?? "not_run",
    });
  }
  return result;
}
