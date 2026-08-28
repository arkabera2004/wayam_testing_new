// Release Gate — ported from aidlc_azure's ReleaseGate page. Evaluates
// whether a project is ready to ship, using Parikshan's own real signals
// (see evaluate.ts's header comment for why these differ from
// aidlc_azure's GitHub/Jira-sourced ones). Not persisted — recomputed on
// demand from current project state.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember } from "@/lib/data/org-access.server";
import { evaluateReleaseGate, type ReleaseGateReport } from "./evaluate";

const RECENT_RESULTS_PER_CASE = 14;

export const evaluateReleaseGateFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }): Promise<ReleaseGateReport> => {
    const db = await getDb();
    const { projects, testPlans, testScenarios, testCases, testRuns, runResults } = collections(db);

    const project = await projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    const testPlan = await testPlans.findOne({ projectId: project._id });
    const scenarios = testPlan
      ? await testScenarios.find({ testPlanId: testPlan._id }).toArray()
      : [];
    const accepted = scenarios.filter((s) => s.status === "accepted").length;
    const coveragePct = scenarios.length ? Math.round((accepted / scenarios.length) * 100) : 0;
    const openCriticalCount = scenarios.filter(
      (s) => (s.priority === "critical" || s.priority === "high") && s.status !== "accepted",
    ).length;

    const [latestRun] = await testRuns
      .find({ projectId: project._id })
      .sort({ startedAt: -1 })
      .limit(1)
      .toArray();
    let passRatePct: number | null = null;
    if (latestRun) {
      const latestResults = await runResults.find({ runId: latestRun._id }).toArray();
      passRatePct = latestResults.length
        ? Math.round(
            (latestResults.filter((r) => r.status === "passed").length / latestResults.length) *
              100,
          )
        : null;
    }

    const cases = await testCases
      .find({ scenarioId: { $in: scenarios.map((s) => s._id) } })
      .toArray();
    const results = await runResults
      .find({ testCaseId: { $in: cases.map((c) => c._id) } })
      .toArray();
    // Quarantined tests never block a release gate — same rule as the
    // dashboard's headline flaky count.
    const quarantinedCaseIds = new Set(
      cases.filter((c) => c.quarantined).map((c) => c._id.toString()),
    );
    const resultsByCase = new Map<string, typeof results>();
    for (const result of results) {
      const key = result.testCaseId.toString();
      if (quarantinedCaseIds.has(key)) continue;
      resultsByCase.set(key, [...(resultsByCase.get(key) ?? []), result]);
    }
    let flakyTestCount = 0;
    for (const caseResults of resultsByCase.values()) {
      const recent = [...caseResults]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-RECENT_RESULTS_PER_CASE);
      for (let i = 1; i < recent.length; i++) {
        if (recent[i]!.status !== recent[i - 1]!.status) {
          flakyTestCount += 1;
          break;
        }
      }
    }

    return evaluateReleaseGate({ coveragePct, passRatePct, openCriticalCount, flakyTestCount });
  });
