import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { listRepos } from "@/lib/github";
import { getGithubConnection } from "@/db/queries";

export async function GET() {
  const userId = await currentUserId();
  const conn = await getGithubConnection(userId);
  if (!conn) return NextResponse.json({ error: "GitHub is not connected." }, { status: 409 });

  try {
    return NextResponse.json({ repos: await listRepos(decryptToken(conn.accessTokenEncrypted)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load repositories." },
      { status: 502 },
    );
  }
}
