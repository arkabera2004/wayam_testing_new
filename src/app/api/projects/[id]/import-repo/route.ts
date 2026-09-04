import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { analyseRepo } from "@/lib/repo-analyse";
import { importPublicRepo, parseRepoUrl } from "@/lib/repo-import";
import { failProgress, setProgress } from "@/lib/import-progress";
import { resolveProject, saveRepoImport } from "@/db/queries";

/**
 * Imports a public repository. No GitHub connection is involved: the tree is
 * read anonymously and file contents come from raw.githubusercontent, so a
 * user only has to paste a link.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  if (!repoUrl) return NextResponse.json({ error: "A repository URL is required." }, { status: 400 });

  const ref = parseRepoUrl(repoUrl);
  if (!ref) {
    return NextResponse.json(
      { error: "That does not look like a GitHub repository URL." },
      { status: 400 },
    );
  }

  try {
    setProgress(project.id, "listing", "Starting");
    const imported = await importPublicRepo(repoUrl, (phase, message, counts) =>
      setProgress(project.id, phase, message, counts),
    );
    const { pages, endpoints } = analyseRepo(imported.files);

    setProgress(project.id, "saving", "Saving what was found");

    const record = await saveRepoImport(userId, project.id, {
      repoUrl: `https://github.com/${imported.owner}/${imported.repo}`,
      ref: imported.ref,
      commitSha: imported.commitSha,
      framework: imported.framework,
      fileCount: imported.fileCount,
      truncated: imported.truncated,
      files: imported.files,
      pages,
      endpoints,
    });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // These screens are server-rendered from what the import just wrote.
    for (const path of ["", "/discovery", "/map", "/repo-baseline", "/settings"]) {
      revalidatePath(`/projects/${id}${path}`);
    }

    setProgress(project.id, "done", `Imported ${imported.fileCount} files`);

    return NextResponse.json({
      repo: `${imported.owner}/${imported.repo}`,
      ref: imported.ref,
      fileCount: imported.fileCount,
      storedCount: record.storedCount,
      framework: imported.framework,
      pages: pages.length,
      endpoints: endpoints.length,
      truncated: imported.truncated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    failProgress(project.id, message);
    // A missing or private repository is the caller's problem, not a fault here.
    const status = /not found|does not look like/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
