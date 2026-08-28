// Defect Prediction — ported from aidlc_azure's DefectPrediction page.
// Analyzes a GitHub-sourced project's recent commit history and scores
// each touched file for defect risk (see risk.ts). Reuses
// parseGithubRepoUrl from scenario-generation.server.ts — same GitHub API,
// same repo-URL parsing, different question asked of it. Not persisted —
// a live report, recomputed on demand.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember } from "@/lib/data/org-access.server";
import { parseGithubRepoUrl } from "@/lib/projects/scenario-generation.server";
import { computeDefectRisk, type CommitInput, type FileRisk } from "./risk";

// Bounded to stay well within GitHub's unauthenticated rate limit (60
// req/hr) — each commit needs its own detail call for the file list.
// GITHUB_TOKEN (see .env.example) raises that ceiling substantially.
const MAX_COMMITS = 20;

function githubHeaders(): HeadersInit {
  const token = process.env["GITHUB_TOKEN"];
  return {
    accept: "application/vnd.github+json",
    "user-agent": "parikshan-defect-prediction",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchRecentCommits(owner: string, repo: string): Promise<CommitInput[]> {
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${MAX_COMMITS}`,
    { headers: githubHeaders() },
  );
  if (!listRes.ok) {
    throw new Error(`GitHub API could not list commits for ${owner}/${repo} (${listRes.status})`);
  }
  const list = (await listRes.json()) as Array<{
    sha: string;
    commit: { message: string; author: { name: string } | null };
  }>;

  const commits: CommitInput[] = [];
  for (const entry of list) {
    const detailRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${entry.sha}`,
      { headers: githubHeaders() },
    );
    if (!detailRes.ok) continue; // best-effort — skip a commit GitHub won't detail for us
    const detail = (await detailRes.json()) as {
      files?: Array<{ filename: string; additions: number; deletions: number }>;
    };
    commits.push({
      message: entry.commit.message,
      author: entry.commit.author?.name ?? null,
      files: (detail.files ?? []).map((f) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
      })),
    });
  }
  return commits;
}

export interface DefectPredictionReport {
  commitsAnalyzed: number;
  files: FileRisk[];
}

export const predictDefectsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }): Promise<DefectPredictionReport> => {
    const db = await getDb();
    const project = await collections(db).projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    if (project.sourceType !== "github") {
      throw new Error("Defect prediction needs a GitHub-sourced project (this one is a Live URL).");
    }
    const ref = parseGithubRepoUrl(project.sourceUrl);
    if (!ref) throw new Error(`Could not parse a GitHub owner/repo out of "${project.sourceUrl}"`);

    const commits = await fetchRecentCommits(ref.owner, ref.repo);
    return { commitsAnalyzed: commits.length, files: computeDefectRisk(commits) };
  });
