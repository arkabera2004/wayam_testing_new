import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { reviewRepoFiles } from "@/lib/repo-review";
import {
  latestRepoImport,
  listRepoFileContents,
  replaceRepoReview,
  resolveProject,
} from "@/db/queries";

/** Reviews the imported source and records the findings. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await listRepoFileContents(userId, project.id);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No source to review. Import a repository first." },
      { status: 409 },
    );
  }

  const { findings, filesReviewed } = reviewRepoFiles(files);
  const lastImport = await latestRepoImport(userId, project.id);

  const result = await replaceRepoReview(userId, project.id, {
    commitSha: lastImport?.commitSha ?? "unknown",
    repo: lastImport?.repoUrl?.replace("https://github.com/", "") ?? project.name,
    filesReviewed,
    findings,
  });
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath(`/projects/${id}/code-review`);
  return NextResponse.json({ findings: findings.length, filesReviewed });
}
