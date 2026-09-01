import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { listSuites, listTestCases, resolveProject } from "@/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  // Resolve first: without this a project belonging to someone else answered
  // 200 with empty arrays while its parent route answered 404. No data leaked
  // either way, but the two disagreed about whether the project exists.
  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [suites, tests] = await Promise.all([
    listSuites(userId, project.id),
    listTestCases(userId, project.id),
  ]);
  return NextResponse.json({ suites, tests });
}
