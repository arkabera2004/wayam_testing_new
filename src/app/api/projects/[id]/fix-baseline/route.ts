import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { SHOPSTACK, rebuildAndRestart } from "@/lib/app-under-test";
import { RunInProgressError, runSuite } from "@/lib/test-runner";
import { createFixBaseline, getTestCase, resolveProject } from "@/db/queries";

/**
 * Records what the spec and the suite looked like before a fix is attempted.
 *
 * Taken by running the suite for real, not by trusting a caller's account of
 * it. The whole harness rests on the before being accurate, so it is measured
 * rather than reported.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const testCaseId = typeof body?.testCaseId === "string" ? body.testCaseId : "";
  if (!testCaseId) return NextResponse.json({ error: "testCaseId is required." }, { status: 400 });

  const testCase = await getTestCase(userId, testCaseId);
  if (!testCase) return NextResponse.json({ error: "Test case not found." }, { status: 404 });
  if (!testCase.playwrightCode) {
    return NextResponse.json({ error: "That test case has no spec to compare against." }, { status: 409 });
  }

  // Built from disk first, so the baseline describes the code as it stands
  // rather than whatever happened to be running.
  const rebuilt = await rebuildAndRestart(SHOPSTACK, process.cwd());
  if (!rebuilt.ok) {
    return NextResponse.json(
      { error: `The application under test failed to ${rebuilt.stage}: ${rebuilt.output.slice(-300)}` },
      { status: 502 },
    );
  }

  // A run already in flight for this project is a temporary conflict, not a
  // fault. Uncaught, it escaped as a bare 500 with no body, which reads as the
  // harness breaking rather than as "wait and try again" - and taking a
  // baseline is exactly the moment someone clicks twice.
  let outcome;
  try {
    outcome = await runSuite(project.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Run failed" },
      { status: err instanceof RunInProgressError ? 409 : 422 },
    );
  }

  const baseline = await createFixBaseline(userId, project.id, {
    testCaseId,
    description: typeof body?.description === "string" ? body.description : "",
    specBefore: testCase.playwrightCode,
    suiteBefore: { total: outcome.total, passed: outcome.passed, failed: outcome.failed },
  });
  if (!baseline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    baselineId: baseline.id,
    suiteBefore: { total: outcome.total, passed: outcome.passed, failed: outcome.failed },
    specAssertions: testCase.playwrightCode.match(/expect\s*\(/g)?.length ?? 0,
  });
}
