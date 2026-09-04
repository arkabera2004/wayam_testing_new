import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { runSuite } from "@/lib/test-runner";
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

  const outcome = await runSuite(project.id);

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
