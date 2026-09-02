import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { encryptToken } from "@/lib/crypto";
import { verifyToken } from "@/lib/github";
import { deleteGithubConnection, getGithubConnection, saveGithubConnection } from "@/db/queries";

/** Current connection state. The token itself is never returned. */
export async function GET() {
  const userId = await currentUserId();
  const conn = await getGithubConnection(userId);
  return NextResponse.json({
    connected: Boolean(conn),
    username: conn?.githubUsername ?? null,
    connectedAt: conn?.connectedAt ?? null,
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token) return NextResponse.json({ error: "A GitHub token is required." }, { status: 400 });

  try {
    // Verify before storing, so a bad token never lands in the database.
    const user = await verifyToken(token);
    await saveGithubConnection(userId, encryptToken(token), user.login);
    return NextResponse.json({ connected: true, username: user.login, name: user.name, avatarUrl: user.avatarUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the token.";
    // A rejected token is the caller's problem, not a server fault.
    return NextResponse.json({ error: message }, { status: message.includes("rejected") ? 400 : 502 });
  }
}

export async function DELETE() {
  const userId = await currentUserId();
  await deleteGithubConnection(userId);
  return NextResponse.json({ connected: false });
}
