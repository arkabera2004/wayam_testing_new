import "server-only";

import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Puts a proposed change on its own branch and puts the working tree back.
 *
 * The branch is created from the current commit and the change is committed
 * only there. main is never checked out, never committed to, and never merged
 * into - a proposal that is rejected leaves nothing behind but a branch someone
 * can delete.
 *
 * The working tree has to hold the change briefly, because verifying a fix
 * means building and running the changed code; there is no way to know whether
 * a fix works without running it. So the file is restored in a finally, whether
 * verification passed, failed or threw.
 */

export type BranchResult = { branch: string; commit: string };

async function git(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: repoRoot, timeout: 20_000 });
  return stdout.trim();
}

export async function currentBranch(repoRoot: string): Promise<string> {
  return git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

/**
 * Applies the change, hands control back to run whatever verification needs the
 * code in place, then restores the file no matter what happened.
 */
export async function withFixApplied<T>(
  repoRoot: string,
  file: string,
  line: number,
  after: string,
  body: () => Promise<T>,
): Promise<T> {
  const full = path.join(repoRoot, file);
  const original = await readFile(full, "utf8");
  const lines = original.split("\n");

  if (lines[line - 1] === undefined) {
    throw new Error(`${file} has no line ${line}; the file changed since the proposal was made.`);
  }

  lines[line - 1] = after;
  await writeFile(full, lines.join("\n"), "utf8");

  try {
    return await body();
  } finally {
    // Unconditional. A verification that throws must not leave the tree edited.
    await writeFile(full, original, "utf8");
  }
}

/**
 * Commits the change to a new branch without disturbing the current one.
 *
 * Uses the plumbing commands rather than checkout, so the branch is written
 * directly into the object store and the working tree is never switched. That
 * removes any window where a build could pick up the wrong branch.
 */
export async function commitToBranch(
  repoRoot: string,
  branch: string,
  file: string,
  contentAfter: string,
  message: string,
): Promise<BranchResult> {
  const head = await git(repoRoot, ["rev-parse", "HEAD"]);

  // execFile has no stdin, so the content goes in via a spawned process.
  const blob = await new Promise<string>((resolve, reject) => {
    const child = spawn("git", ["hash-object", "-w", "--stdin"], { cwd: repoRoot });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`git hash-object exited ${code}`)),
    );
    child.stdin.write(contentAfter);
    child.stdin.end();
  });

  // Build a tree from HEAD's, with the one path swapped.
  const mode = "100644";
  await git(repoRoot, ["read-tree", head]);
  await git(repoRoot, ["update-index", "--add", "--cacheinfo", `${mode},${blob},${file}`]);
  const tree = await git(repoRoot, ["write-tree"]);

  const commit = await git(repoRoot, ["commit-tree", tree, "-p", head, "-m", message]);
  await git(repoRoot, ["update-ref", `refs/heads/${branch}`, commit]);

  // Leave the index matching HEAD again, so nothing appears staged afterwards.
  await git(repoRoot, ["read-tree", head]);

  return { branch, commit };
}

export async function branchDiff(repoRoot: string, branch: string): Promise<string> {
  try {
    return await git(repoRoot, ["diff", "HEAD", `refs/heads/${branch}`]);
  } catch {
    return "";
  }
}
