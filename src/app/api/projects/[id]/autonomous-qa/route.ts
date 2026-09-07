import { NextResponse } from "next/server";

import { resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { runAutonomousQa } from "@/lib/qa/orchestrator";

/**
 * One autonomous QA pass: discover, probe, judge, select, and optionally
 * assess stability.
 *
 * The base URL is taken from the project rather than the request. What gets
 * crawled and probed should be the application the project already says it
 * owns, not somewhere a caller names - "explore this address" would otherwise
 * be a way to point the crawler at anything reachable from this host.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!project.baseUrl) {
    return NextResponse.json(
      { error: "This project has no base URL. Exploration needs a running application to explore." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const stabilityRuns = typeof body?.stabilityRuns === "number" ? body.stabilityRuns : 0;
  const since = typeof body?.since === "string" ? body.since : undefined;

  try {
    const report = await runAutonomousQa({
      projectId: project.id,
      baseUrl: project.baseUrl,
      repoRoot: process.cwd(),
      stabilityRuns,
      since,
    });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The QA pass did not complete." },
      { status: 500 },
    );
  }
}
