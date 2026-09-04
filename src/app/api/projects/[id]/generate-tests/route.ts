import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { generateSpecsForRoutes } from "@/lib/spec-generator";
import {
  listDiscoveredRoutes,
  listRepoFileContents,
  replaceGeneratedSuite,
  resolveProject,
} from "@/db/queries";

/**
 * Writes a Playwright spec for every discovered route, so an imported
 * repository ends up with something the suite can actually run.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const baseUrl =
    (typeof body?.baseUrl === "string" && body.baseUrl.trim()) || project.baseUrl || "";

  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          "Set the application's base URL first, in project settings. A spec needs somewhere to navigate to.",
      },
      { status: 409 },
    );
  }

  const routes = await listDiscoveredRoutes(userId, project.id);
  if (routes.length === 0) {
    return NextResponse.json(
      { error: "No routes have been discovered yet. Import a repository first." },
      { status: 409 },
    );
  }

  // The markup each route renders from, so the specs can assert what the code
  // actually declares rather than only that a page loaded.
  const files = await listRepoFileContents(userId, project.id);
  const sourceByPath = new Map(files.map((f) => [f.path, f.content]));

  const cases = generateSpecsForRoutes(
    routes.map((r) => ({
      path: r.path,
      title: r.title,
      forms: r.forms ?? 0,
      gated: Boolean(r.gated),
      risk: r.risk,
      sourceFile: r.sourceFile,
      source: r.sourceFile ? (sourceByPath.get(r.sourceFile) ?? null) : null,
    })),
    baseUrl,
  );

  const result = await replaceGeneratedSuite(userId, project.id, cases);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const path of ["", "/tests", "/plan", "/runs", "/repo-baseline"]) {
    revalidatePath(`/projects/${id}${path}`);
  }

  return NextResponse.json({ generated: result.count, baseUrl });
}
