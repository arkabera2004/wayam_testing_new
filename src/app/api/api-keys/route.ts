import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { createApiKey, listApiKeys } from "@/db/queries";

export async function GET() {
  const userId = await currentUserId();
  return NextResponse.json({ keys: await listApiKeys(userId) });
}

/**
 * Mints a key. The secret is returned exactly once and only its SHA-256 is
 * stored, so a leaked database does not hand over working credentials and the
 * UI can never show the full key again.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const secret = `psk_${randomBytes(24).toString("hex")}`;
  const row = await createApiKey(
    userId,
    name,
    secret.slice(0, 12),
    createHash("sha256").update(secret).digest("hex"),
  );

  return NextResponse.json({ id: row.id, name: row.name, secret }, { status: 201 });
}
