import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { branchDiff, commitToBranch, currentBranch, withFixApplied } from "@/lib/fix-branch";
import { verifyFix } from "@/lib/fix-verifier";
import { proposeFix } from "@/lib/fixer";
import { runSuite } from "@/lib/test-runner";
import { createFixProposal, getResultForFix, getTestCase, resolveProject } from "@/db/queries";

/**
 * Proposes a fix for one classified real bug, verifies it, and stops.
 *
 * The order matters. The change is put on a branch first, so a proposal exists
 * independently of whether it survives verification. It is then applied to the
 * working tree only for as long as it takes to build and run - there is no way
 * to know whether a fix works without running the changed code - and restored
 * unconditionally afterwards.
 *
 * Nothing merges. A verdict of accepted from the harness means a human should
 * look, not that anything has happened. That holds regardless of how confident
 * the harness is, and there is no code path here that could change it.
 */
const SOURCE_ROOTS = ["src/app/demo/shopstack", "src/app", "src/lib", "src/components"];

async function candidateFiles(repoRoot: string): Promise<string[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const { stdout } = await run("git", ["ls-files", ...SOURCE_ROOTS], { cwd: repoRoot, timeout: 20_000 });
  return stdout.split("\n").filter((f) => /\.(tsx?|jsx?)$/.test(f));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const resultId = typeof body?.resultId === "string" ? body.resultId : "";
  if (!resultId) return NextResponse.json({ error: "resultId is required." }, { status: 400 });

  const result = await getResultForFix(userId, resultId);
  if (!result) return NextResponse.json({ error: "Result not found." }, { status: 404 });

  const repoRoot = process.cwd();
  const proposal = await proposeFix({
    classification: result.classification,
    errorMessage: result.errorMessage,
    sourceRoot: repoRoot,
    candidateFiles: await candidateFiles(repoRoot),
  });

  if ("refused" in proposal) {
    return NextResponse.json({ proposed: false, reason: proposal.reason }, { status: 200 });
  }

  const testCase = await getTestCase(userId, result.testCaseId as string);
  if (!testCase?.playwrightCode) {
    return NextResponse.json({ error: "The failing test case has no spec." }, { status: 409 });
  }

  // Baseline before anything is touched.
  const suiteBefore = await runSuite(project.id);

  const full = path.join(repoRoot, proposal.file);
  const original = await readFile(full, "utf8");
  const lines = original.split("\n");
  lines[proposal.line - 1] = proposal.after;
  const contentAfter = lines.join("\n");

  const branch = `parikshan/fix-${resultId.slice(0, 8)}`;
  const onBranch = await currentBranch(repoRoot);
  const committed = await commitToBranch(
    repoRoot,
    branch,
    proposal.file,
    contentAfter,
    `Proposed fix: ${proposal.rationale.slice(0, 120)}`,
  );
  const diff = await branchDiff(repoRoot, branch);

  // Applied only long enough to be tested, then put back.
  const { targetPasses, suiteAfter } = await withFixApplied(
    repoRoot,
    proposal.file,
    proposal.line,
    proposal.after,
    async () => {
      const target = await runSuite(project.id, { caseIds: [result.testCaseId as string] });
      const suite = await runSuite(project.id);
      return { targetPasses: target.failed === 0, suiteAfter: suite };
    },
  );

  // The application under test here is served from a build, and this route is
  // running inside that same server - so a source edit cannot reach the running
  // app, and rebuilding would kill the process doing the verifying. Rather than
  // emit a rejection that means nothing, the harness is told it cannot judge.
  const servedFromBuild = proposal.file.startsWith("src/") && process.env.NODE_ENV === "production";

  const verdict = verifyFix({
    specBefore: testCase.playwrightCode,
    // The fixer cannot edit specs, so this is the same text by construction.
    // Passing it through the harness anyway keeps the check honest rather than
    // assumed.
    specAfter: testCase.playwrightCode,
    targetSpecPasses: targetPasses,
    suiteBefore: { total: suiteBefore.total, passed: suiteBefore.passed, failed: suiteBefore.failed },
    suiteAfter: { total: suiteAfter.total, passed: suiteAfter.passed, failed: suiteAfter.failed },
    unverifiableReason: servedFromBuild
      ? `The change is to ${proposal.file}, which this application serves from a compiled build. Editing the source does not change what is running, and rebuilding would restart the process performing the verification. An application under test that is a separate process can be rebuilt between the baseline and the re-run; this one cannot.`
      : null,
  });

  const record = await createFixProposal(project.id, {
    testCaseId: result.testCaseId as string,
    resultId,
    branch: committed.branch,
    commitSha: committed.commit,
    filePath: proposal.file,
    lineNumber: proposal.line,
    before: proposal.before,
    after: proposal.after,
    rationale: proposal.rationale,
    caveat: proposal.caveat,
    diff,
    state: verdict.outcome === "rejected" ? "rejected_by_harness" : "proposed",
    harnessVerdict: verdict.outcome,
    harnessReasons: verdict.reasons,
  });

  revalidatePath(`/projects/${id}/healing`);

  return NextResponse.json({
    proposed: true,
    proposalId: record.id,
    branch: committed.branch,
    commit: committed.commit,
    workingBranchUntouched: onBranch,
    file: proposal.file,
    line: proposal.line,
    before: proposal.before,
    after: proposal.after,
    rationale: proposal.rationale,
    caveat: proposal.caveat,
    harness: {
      verdict: verdict.outcome,
      reasons: verdict.reasons,
      targetSpecPasses: verdict.targetSpecPasses,
      suiteRegressed: verdict.suiteRegressed,
      suiteBefore: { total: suiteBefore.total, passed: suiteBefore.passed, failed: suiteBefore.failed },
      suiteAfter: { total: suiteAfter.total, passed: suiteAfter.passed, failed: suiteAfter.failed },
    },
    merged: false,
    note: "Nothing was merged. The change exists only on its branch; a human decides what happens to it.",
  });
}
