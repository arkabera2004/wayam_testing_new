import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { createPrdDocument, resolveProject } from "@/db/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled PRD";

  if (!text) return NextResponse.json({ error: "The document is empty." }, { status: 400 });

  const row = await createPrdDocument(userId, project.id, { name, body: text });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The PRD list is server-rendered, so it needs its cache dropped.
  revalidatePath(`/projects/${id}/prd`);
  return NextResponse.json({ id: row.id, name: row.name, status: row.status }, { status: 201 });
}
