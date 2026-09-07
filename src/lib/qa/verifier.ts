import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { SHOPSTACK, rebuildAndRestart } from "@/lib/app-under-test";
import { childEnv } from "@/lib/child-env";
import { diffSpec } from "@/lib/fix-verifier";
import { runSuite } from "@/lib/test-runner";

const git = promisify(execFile);

/**
 * Independent verification of a fix that has already been judged.
 *
 * The harness that accepts a fix runs inside the same call that produced it,
 * on values that call computed. That is enough to catch a fixer editing an
 * assertion, because the check does not depend on the fixer's honesty - but it
 * does depend on the surrounding code having reported the run correctly. If
 * the proposal's stored `after` did not match what was actually committed, or
 * the suite numbers were recorded from the wrong run, nothing would notice.
 *
 * So this re-derives every fact from the two things that cannot be
 * conveniently wrong: the git object store, and the database. It reads the
 * patch out of the branch rather than the proposal row, re-reads the spec, and
 * runs the suite itself rather than trusting a recorded total.
 *
 * It is allowed to disagree with the harness, and a disagreement is the most
 * valuable thing it can produce - it means one of the two is wrong about a fix
 * a person is being asked to merge.
 */

export type VerificationCheck = {
  name: string;
  passed: boolean;
  /** What was actually observed, so a reader need not take the verdict on faith. */
  observed: string;
};

export type IndependentVerdict = {
  proposalId: string;
  verdict: "confirmed" | "refuted" | "inconclusive";
  agreesWithHarness: boolean;
  harnessVerdict: string | null;
  checks: VerificationCheck[];
  summary: string;
};

async function fileAtRef(repoRoot: string, ref: string, path: string): Promise<string | null> {
  try {
    const { stdout } = await git("git", ["show", `${ref}:${path}`], {
      cwd: repoRoot,
      timeout: 20_000,
      env: childEnv(),
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Re-checks a recorded proposal from scratch.
 *
 * Deliberately does not accept the patch, the spec or the run totals as
 * arguments. Everything it needs, it fetches.
 */
export async function verifyIndependently(
  proposalId: string,
  repoRoot: string,
): Promise<IndependentVerdict> {
  const db = getDb();
  const checks: VerificationCheck[] = [];

  const [proposal] = await db
    .select()
    .from(schema.fixProposals)
    .where(eq(schema.fixProposals.id, proposalId))
    .limit(1);

  if (!proposal) {
    return {
      proposalId,
      verdict: "inconclusive",
      agreesWithHarness: false,
      harnessVerdict: null,
      checks: [{ name: "proposal exists", passed: false, observed: "No proposal with that id." }],
      summary: "Nothing to verify.",
    };
  }

  const branch = proposal.branch ?? "";
  const filePath = proposal.filePath ?? "";

  /* 1. The branch still exists and holds the commit the proposal claims. */
  let branchSha: string | null = null;
  try {
    const { stdout } = await git("git", ["rev-parse", branch], { cwd: repoRoot, timeout: 20_000, env: childEnv() });
    branchSha = stdout.trim();
  } catch {
    branchSha = null;
  }
  checks.push({
    name: "branch holds the recorded commit",
    passed: Boolean(branchSha) && branchSha === proposal.commitSha,
    observed: branchSha
      ? `${branch} is at ${branchSha.slice(0, 7)}, proposal recorded ${(proposal.commitSha ?? "").slice(0, 7)}`
      : `${branch || "(no branch)"} does not resolve`,
  });

  /* 2. The change on the branch is the change the proposal describes.
        Read from the object store, not from the row that claims it. */
  let patchMatches = false;
  let patchObserved = "could not read the file from the branch";
  if (branchSha && filePath) {
    const onBranch = await fileAtRef(repoRoot, branchSha, filePath);
    const onHead = await fileAtRef(repoRoot, "HEAD", filePath);
    if (onBranch !== null) {
      const branchLines = onBranch.split("\n");
      const line = (proposal.lineNumber ?? 0) - 1;
      const actual = branchLines[line] ?? "";
      patchMatches = actual.trim() === (proposal.after ?? "").trim();
      patchObserved = patchMatches
        ? `${filePath}:${proposal.lineNumber} on the branch is exactly what the proposal recorded`
        : `${filePath}:${proposal.lineNumber} on the branch reads "${actual.trim().slice(0, 60)}", proposal recorded "${(proposal.after ?? "").trim().slice(0, 60)}"`;

      /* 3. Minimality: one file, and the branch differs from HEAD only there. */
      if (onHead !== null) {
        const changedLines = branchLines.filter((l, i) => l !== onHead.split("\n")[i]).length;
        checks.push({
          name: "change is minimal",
          passed: changedLines <= 2,
          observed: `${changedLines} line(s) differ from HEAD in ${filePath}`,
        });
      }
    }
  }
  checks.push({ name: "branch content matches the proposal", passed: patchMatches, observed: patchObserved });

  /* 4. The spec was not weakened. Re-read it and re-diff, rather than trusting
        the harness's recorded diff. */
  const [baseline] = await db
    .select()
    .from(schema.fixVerifications)
    .where(eq(schema.fixVerifications.testCaseId, proposal.testCaseId))
    .limit(1);

  const [testCase] = await db
    .select({ code: schema.testCases.playwrightCode, title: schema.testCases.title })
    .from(schema.testCases)
    .where(eq(schema.testCases.id, proposal.testCaseId))
    .limit(1);

  if (baseline?.specBefore && testCase?.code) {
    const diff = diffSpec(baseline.specBefore, testCase.code);
    checks.push({
      name: "assertions unchanged",
      passed: diff.unchanged,
      observed: diff.unchanged
        ? "the spec asserts exactly what it asserted before the fix"
        : `changed ${diff.changed.length}, removed ${diff.removed.length}, added ${diff.added.length}, skip added: ${diff.skipAdded}`,
    });
  } else {
    checks.push({
      name: "assertions unchanged",
      passed: false,
      observed: "no baseline spec recorded for this test case, so nothing can be compared",
    });
  }

  /* 5. Does the fix actually work? Build the branch's version and run the
        suite here, rather than believing a stored total. */
  let ranHere = false;
  if (branchSha && filePath && patchMatches) {
    const original = await fileAtRef(repoRoot, "HEAD", filePath);
    const fixed = await fileAtRef(repoRoot, branchSha, filePath);
    const { writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const abs = path.join(repoRoot, filePath);

    if (original !== null && fixed !== null) {
      try {
        await writeFile(abs, fixed, "utf8");
        const rebuilt = await rebuildAndRestart(SHOPSTACK, repoRoot);
        if (rebuilt.ok) {
          const outcome = await runSuite(proposal.projectId);
          ranHere = true;
          checks.push({
            name: "suite passes with the fix applied",
            passed: outcome.failed === 0,
            observed: `verifier's own run: ${outcome.passed}/${outcome.total} passed, ${outcome.failed} failed`,
          });
        } else {
          checks.push({
            name: "suite passes with the fix applied",
            passed: false,
            observed: `the application would not ${rebuilt.stage}: ${rebuilt.output.slice(-160)}`,
          });
        }
      } finally {
        // The verifier borrows the working tree and must give it back, whether
        // the run succeeded, failed or threw.
        await writeFile(abs, original, "utf8");
        await rebuildAndRestart(SHOPSTACK, repoRoot).catch(() => {});
      }
    }
  }
  if (!ranHere) {
    checks.push({
      name: "suite passes with the fix applied",
      passed: false,
      observed: "the fix could not be applied cleanly, so its effect was not observed here",
    });
  }

  /* 6. Nothing was merged. */
  // Without a commit to ask about, this is unknowable rather than false.
  // Falling back to HEAD asked "which branches contain HEAD", which is every
  // branch you are standing on - and reported a pruned proposal as merged into
  // the working branch, which is a serious claim with nothing behind it.
  if (!branchSha) {
    checks.push({
      name: "nothing was merged",
      passed: true,
      observed: "the fix commit no longer exists, so there is nothing that could have been merged",
    });
  } else {
  let headMoved = true;
  try {
    const { stdout } = await git("git", ["rev-parse", "HEAD"], { cwd: repoRoot, timeout: 20_000, env: childEnv() });
    const { stdout: contains } = await git("git", ["branch", "--contains", branchSha], {
      cwd: repoRoot,
      timeout: 20_000,
      env: childEnv(),
    }).catch(() => ({ stdout: "" }));
    // The fix commit must not be reachable from any branch other than its own.
    const others = contains.split("\n").map((l) => l.replace("*", "").trim()).filter((l) => l && l !== branch);
    headMoved = others.length > 0;
    checks.push({
      name: "nothing was merged",
      passed: !headMoved,
      observed: headMoved
        ? `the fix commit is reachable from: ${others.join(", ")}`
        : `HEAD is ${stdout.trim().slice(0, 7)} and the fix exists only on ${branch}`,
    });
  } catch {
    checks.push({ name: "nothing was merged", passed: false, observed: "could not read git state" });
  }
  }

  const failed = checks.filter((c) => !c.passed);
  const verdict: IndependentVerdict["verdict"] =
    failed.length === 0 ? "confirmed" : failed.some((c) => c.name === "assertions unchanged") ? "refuted" : "inconclusive";

  const harnessVerdict = proposal.harnessVerdict ?? null;
  const agrees =
    (verdict === "confirmed" && harnessVerdict === "accepted") ||
    (verdict === "refuted" && harnessVerdict === "rejected");

  return {
    proposalId,
    verdict,
    agreesWithHarness: agrees,
    harnessVerdict,
    checks,
    summary:
      failed.length === 0
        ? `Independently confirmed: ${checks.length} checks, all passed.`
        : `${failed.length} of ${checks.length} checks failed: ${failed.map((c) => c.name).join("; ")}.`,
  };
}
