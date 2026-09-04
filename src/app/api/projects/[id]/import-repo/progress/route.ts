import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { getProgress } from "@/lib/import-progress";
import { resolveProject } from "@/db/queries";

/** Where a running import has got to. Null means nothing is running. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ progress: getProgress(project.id) });
}
