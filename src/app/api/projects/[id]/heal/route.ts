import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getDb, schema } from "@/db";
import { resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { healSelector } from "@/lib/healer";

/**
 * Heals a broken selector against a live page and records the result.
 *
 * The event is written whether or not a replacement was found - a heal that
 * failed is worth seeing, since it means the test needs a human.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const url: string | undefined = body?.url;
  const selector: string | undefined = body?.selector;

  if (!url || !selector) {
    return NextResponse.json({ error: "url and selector are required" }, { status: 400 });
  }

  try {
    const result = await healSelector(url, selector);

    if (result.healed) {
      const db = getDb();
      await db.insert(schema.healingEvents).values({
        projectId: project.id,
        testCaseId: body?.testCaseId ?? null,
        oldSelector: selector,
        newSelector: result.healed.selector,
        strategy: result.healed.strategy,
        similarity: result.healed.similarity,
        reason: `${result.healed.reason} Found in a ${result.browser} browser session at ${url}.`,
        status: "pending",
        minutesSaved: 15,
      });
      revalidatePath(`/projects/${id}/healing`);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Healing failed" },
      { status: 422 },
    );
  }
}
