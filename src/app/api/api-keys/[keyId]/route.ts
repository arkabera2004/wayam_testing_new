import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { revokeApiKey } from "@/db/queries";

/** Revokes rather than deletes, so the audit trail survives. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const { keyId } = await params;
  const userId = await currentUserId();

  const row = await revokeApiKey(userId, keyId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: row.id, revokedAt: row.revokedAt });
}
