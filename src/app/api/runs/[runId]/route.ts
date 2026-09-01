import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { getRunWithResults } from "@/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const userId = await currentUserId();
  const data = await getRunWithResults(userId, runId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
