// Repo Baseline — ported from aidlc_azure's RepoBaseline page. Scans a
// GitHub-sourced project's file tree + README (reusing
// parseGithubRepoUrl/fetchGithubRepoContext from
// scenario-generation.server.ts — same fetch, different question asked of
// it) and reports a structural snapshot. Not persisted — a live report,
// recomputed on demand.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { ForbiddenError, requireOrgMember } from "@/lib/data/org-access.server";
import {
  fetchGithubRepoContext,
  parseGithubRepoUrl,
} from "@/lib/projects/scenario-generation.server";
import { analyzeRepoBaseline, type RepoBaselineReport } from "./analyze";

export const getRepoBaselineFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ context, data }): Promise<RepoBaselineReport> => {
    const db = await getDb();
    const project = await collections(db).projects.findOne({ _id: new ObjectId(data.projectId) });
    if (!project) throw new ForbiddenError("Project not found");
    await requireOrgMember(db, project.orgId, context.user._id);

    if (project.sourceType !== "github") {
      throw new Error("Repo baseline needs a GitHub-sourced project (this one is a Live URL).");
    }
    const ref = parseGithubRepoUrl(project.sourceUrl);
    if (!ref) throw new Error(`Could not parse a GitHub owner/repo out of "${project.sourceUrl}"`);

    const repoContext = await fetchGithubRepoContext(ref);
    return analyzeRepoBaseline(repoContext.filePaths, repoContext.readme);
  });
