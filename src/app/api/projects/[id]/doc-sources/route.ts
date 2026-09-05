import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { createDocSource, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

/** Refuse anything large enough to suggest the wrong file was picked. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Accepts a specification and stores the scenarios it describes.
 *
 * Text in, text out. The document arrives as a string the client has already
 * read, because what the parser needs is characters - accepting a PDF here
 * would mean claiming to understand a format nothing in this build can read.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = await request.json().catch(() => ({}));
  const name = typeof payload?.name === "string" && payload.name.trim() ? payload.name.trim() : "Untitled document";
  const body = typeof payload?.body === "string" ? payload.body : "";

  if (!body.trim()) {
    return NextResponse.json({ error: "The document is empty." }, { status: 400 });
  }
  if (Buffer.byteLength(body, "utf8") > MAX_BYTES) {
    return NextResponse.json(
      { error: "That document is over 2MB. Paste the relevant section instead." },
      { status: 413 },
    );
  }

  const result = await createDocSource(userId, project.id, { name, body });
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath(`/projects/${id}/doc-tests`);

  return NextResponse.json(
    { id: result.document.id, name: result.document.name, scenarios: result.scenarioCount },
    { status: 201 },
  );
}
