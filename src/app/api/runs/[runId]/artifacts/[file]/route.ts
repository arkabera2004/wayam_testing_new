import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth";
import { getRunWithResults } from "@/db/queries";

const ARTIFACT_ROOT = "run-artifacts";
/** Both segments are uuid-shaped; anything else is not ours to serve. */
const SAFE = /^[0-9a-f-]{36}$/i;

/**
 * Streams a screenshot captured during a run.
 *
 * The run is loaded through the same scoped query the UI uses, so a caller
 * cannot read another tenant's evidence by guessing a run id. Both path
 * segments are pattern-checked before touching the filesystem rather than
 * relying on path.join to contain a traversal.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ runId: string; file: string }> },
) {
  const { runId, file } = await params;
  const base = file.replace(/\.png$/i, "");

  if (!SAFE.test(runId) || !SAFE.test(base)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await currentUserId();
  const run = await getRunWithResults(userId, runId);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const bytes = await readFile(path.join(process.cwd(), ARTIFACT_ROOT, runId, base + ".png"));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/png",
        // Immutable: a run's screenshot never changes once recorded.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
