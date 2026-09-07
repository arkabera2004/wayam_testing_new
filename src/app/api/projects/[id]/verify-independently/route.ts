import { NextResponse } from "next/server";

import { resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { verifyIndependently } from "@/lib/qa/verifier";

/**
 * Re-checks a fix proposal without trusting the call that produced it.
 *
 * Separate from propose-fix on purpose: a verification that runs inside the
 * same request, on the same values, cannot notice that those values were wrong.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const proposalId = typeof body?.proposalId === "string" ? body.proposalId : "";
  if (!proposalId) return NextResponse.json({ error: "proposalId is required." }, { status: 400 });

  try {
    return NextResponse.json(await verifyIndependently(proposalId, process.cwd()));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification did not complete." },
      { status: 500 },
    );
  }
}
