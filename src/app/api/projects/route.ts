import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { createProject, listProjects } from "@/db/queries";

export async function GET() {
  const userId = await currentUserId();
  return NextResponse.json({ projects: await listProjects(userId) });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  const body = await request.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const project = await createProject({
    userId,
    name: body.name,
    description: body.description,
    githubRepoUrl: body.githubRepoUrl,
    githubDefaultBranch: body.githubDefaultBranch,
  });
  return NextResponse.json({ project }, { status: 201 });
}
