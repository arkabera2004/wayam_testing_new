import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getDb, schema } from "@/db";
import { listRepoFileContents, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { healSelector } from "@/lib/healer";
import { healFromRepo } from "@/lib/healer-repo";

/**
 * Heals a broken selector and records the result.
 *
 * Two sources, and a URL is no longer required. Given one, a browser opens the
 * page and reads the live DOM, which is the stronger evidence. Without one the
 * imported repository is searched instead, because the markup a page will
 * render is in the source - and most projects here are imported code with
 * nothing deployed, which previously left them unable to heal at all.
 *
 * The event is written whether or not a replacement was found: a heal that
 * failed is worth seeing, since it means the test needs a human.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const selector: string | undefined = body?.selector;
  const url: string | undefined = body?.url ?? project.baseUrl ?? undefined;

  if (!selector) {
    return NextResponse.json({ error: "selector is required" }, { status: 400 });
  }

  const db = getDb();

  async function record(
    newSelector: string,
    strategy: string | null,
    similarity: number,
    reason: string,
  ) {
    await db.insert(schema.healingEvents).values({
      projectId: project!.id,
      testCaseId: body?.testCaseId ?? null,
      oldSelector: selector as string,
      newSelector,
      strategy,
      similarity,
      reason,
      status: "pending",
      minutesSaved: 15,
    });
    revalidatePath(`/projects/${id}/healing`);
  }

  try {
    if (url) {
      const result = await healSelector(url, selector);
      if (result.healed) {
        await record(
          result.healed.selector,
          result.healed.strategy,
          result.healed.similarity,
          `${result.healed.reason} Found in a ${result.browser} browser session at ${url}.`,
        );
      }
      return NextResponse.json({ ...result, source: "browser" }, { status: 200 });
    }

    // No URL: fall back to the imported source.
    const files = await listRepoFileContents(userId, project.id);
    if (files.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nothing to heal against. Set a base URL in project settings so a browser can open the page, or import a repository so the source can be read.",
        },
        { status: 409 },
      );
    }

    const result = healFromRepo(files, selector);
    if (result.healed) {
      await record(
        result.healed.selector,
        result.healed.strategy,
        result.healed.similarity,
        result.healed.reason,
      );
    }

    return NextResponse.json(
      {
        source: "repository",
        brokenSelector: selector,
        healed: result.healed,
        candidates: result.candidates,
        filesScanned: result.filesScanned,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Healing failed" },
      { status: 422 },
    );
  }
}
