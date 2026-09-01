import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { listRuns } from "@/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  return NextResponse.json({ runs: await listRuns(userId, id) });
}
