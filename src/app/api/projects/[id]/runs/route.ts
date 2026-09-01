import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { listRuns, resolveProject } from "@/db/queries";
import { runSuite } from "@/lib/test-runner";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ runs: await listRuns(userId, project.id) });
}

/**
 * Executes the project's specs with the real Playwright runner and records the
 * results. Runs synchronously: a suite this size finishes well inside the
 * request, and a job queue is only worth adding once runs outlive it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  try {
    const outcome = await runSuite(project.id, { baseUrl: body?.baseUrl });

    // The runs table and overview are server-rendered, so a client-side
    // router.refresh() alone would re-request a still-cached payload and the
    // new run would not appear until a hard reload.
    revalidatePath(`/projects/${id}/runs`);
    revalidatePath(`/projects/${id}`);

    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    // A suite with nothing runnable is a normal state to be told about, not a
    // server fault, so it comes back as a 422 with the reason.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Run failed" },
      { status: 422 },
    );
  }
}
