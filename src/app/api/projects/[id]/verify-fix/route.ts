import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { verifyFix } from "@/lib/fix-verifier";
import { runSuite } from "@/lib/test-runner";
import { getFixBaseline, getTestCase, recordFixVerdict, resolveProject } from "@/db/queries";

/**
 * Judges a fix against the baseline taken before it.
 *
 * Re-runs the spec that was failing, re-runs the whole suite, and diffs the
 * spec against what it was. A change to what the test asserts is a rejection
 * even when everything now passes - especially then, since that is exactly what
 * a fix that only silenced the test looks like.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const baselineId = typeof body?.baselineId === "string" ? body.baselineId : "";
  if (!baselineId) return NextResponse.json({ error: "baselineId is required." }, { status: 400 });

  const baseline = await getFixBaseline(userId, baselineId);
  if (!baseline) return NextResponse.json({ error: "Baseline not found." }, { status: 404 });

  const testCase = await getTestCase(userId, baseline.testCaseId);
  if (!testCase?.playwrightCode) {
    return NextResponse.json({ error: "The test case no longer has a spec." }, { status: 409 });
  }

  // The target spec on its own first, so its result is not confused with the
  // rest of the suite's.
  const targetRun = await runSuite(project.id, { caseIds: [baseline.testCaseId] });
  const suiteRun = await runSuite(project.id);

  const verdict = verifyFix({
    specBefore: baseline.specBefore,
    specAfter: testCase.playwrightCode,
    targetSpecPasses: targetRun.failed === 0,
    suiteBefore: baseline.suiteBefore ?? { total: 0, passed: 0, failed: 0 },
    suiteAfter: { total: suiteRun.total, passed: suiteRun.passed, failed: suiteRun.failed },
  });

  await recordFixVerdict(baselineId, {
    specAfter: testCase.playwrightCode,
    suiteAfter: { total: suiteRun.total, passed: suiteRun.passed, failed: suiteRun.failed },
    verdict: verdict.outcome,
    reasons: verdict.reasons,
    specDiff: verdict.diff,
  });

  revalidatePath(`/projects/${id}/runs`);

  return NextResponse.json({
    verdict: verdict.outcome,
    reasons: verdict.reasons,
    targetSpecPasses: verdict.targetSpecPasses,
    suiteRegressed: verdict.suiteRegressed,
    specChanged: !verdict.diff.unchanged,
    diff: {
      removed: verdict.diff.removed.length,
      added: verdict.diff.added.length,
      changed: verdict.diff.changed.length,
      skipAdded: verdict.diff.skipAdded,
    },
    suiteBefore: baseline.suiteBefore,
    suiteAfter: { total: suiteRun.total, passed: suiteRun.passed, failed: suiteRun.failed },
  });
}
