import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { setDocScenarioSelected } from "@/db/queries";

/** Persists a scenario's include/exclude toggle. */
export async function PATCH(request: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const userId = await currentUserId();

  const body = await request.json().catch(() => ({}));
  if (typeof body?.selected !== "boolean") {
    return NextResponse.json({ error: "selected must be a boolean." }, { status: 400 });
  }

  const row = await setDocScenarioSelected(userId, scenarioId, body.selected);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: row.id, selected: row.selected });
}
