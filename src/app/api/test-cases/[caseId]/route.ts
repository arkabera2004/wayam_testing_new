import { NextResponse } from "next/server";

import { setCaseApproved } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

/** Accepts or un-accepts a proposed scenario. */
export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const userId = await currentUserId();
  const body = await request.json().catch(() => null);

  if (typeof body?.approved !== "boolean") {
    return NextResponse.json({ error: "approved must be a boolean" }, { status: 400 });
  }

  const row = await setCaseApproved(userId, caseId, body.approved);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ testCase: { id: row.id, approved: row.automationStatus === "automated" } });
}
