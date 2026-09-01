import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { setHealingStatus } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const userId = await currentUserId();
  const body = await request.json().catch(() => null);

  if (body?.status !== "accepted" && body?.status !== "reverted") {
    return NextResponse.json({ error: "status must be accepted or reverted" }, { status: 400 });
  }

  const row = await setHealingStatus(userId, eventId, body.status);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The healing screen is server-rendered, so the list needs invalidating or
  // an accepted repair keeps showing its Accept button until a hard reload.
  revalidatePath("/projects/[id]/healing", "page");
  return NextResponse.json({ event: { id: row.id, status: row.status } });
}
