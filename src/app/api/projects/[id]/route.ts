import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { deleteProject, getProject, projectStats, updateProject } from "@/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const userId = await currentUserId();
  const project = await getProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project, stats: await projectStats(userId, id) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const userId = await currentUserId();
  const patch = await request.json().catch(() => ({}));
  const project = await updateProject(userId, id, patch);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  const userId = await currentUserId();
  const ok = await deleteProject(userId, id);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
