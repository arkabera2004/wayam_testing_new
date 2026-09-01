import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { listSuites, listTestCases } from "@/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  const [suites, tests] = await Promise.all([listSuites(userId, id), listTestCases(userId, id)]);
  return NextResponse.json({ suites, tests });
}
