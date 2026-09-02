import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth";
import { getPrdDocument, resolveProject } from "@/db/queries";

import { PrdAnalysisView, type PrdCase, type PrdRequirement } from "./prd-analysis-view";

export default async function PrdAnalysisPage({
  params,
}: {
  params: Promise<{ id: string; prdId: string }>;
}) {
  const { id, prdId } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const data = await getPrdDocument(userId, project.id, prdId);
  if (!data) notFound();

  const requirements: PrdRequirement[] = data.requirements.map((r) => ({
    id: r.id,
    text: r.title,
    kind: (r.kind ?? "functional") as PrdRequirement["kind"],
    priority: (r.priority ?? "P2") as PrdRequirement["priority"],
    coverage: r.coverage,
    cases: r.cases,
    ambiguity: r.ambiguity ?? undefined,
  }));

  // Approval is stored as the case's automation status, so "approved" here
  // means the same thing it means on the Tests screen.
  const cases: PrdCase[] = data.cases.map((c) => ({
    id: c.caseId as string,
    requirement: c.requirementId as string,
    title: c.title ?? "",
    expectation: c.expectedResult ?? c.description ?? "",
    tags: [c.type ?? "ui"],
    priority: (c.priority === "critical" ? "P0" : c.priority === "high" ? "P1" : "P2") as PrdCase["priority"],
    steps: c.steps ?? [],
    approved: c.automation === "automated",
  }));

  return (
    <PrdAnalysisView
      id={id}
      requirements={requirements}
      initialCases={cases}
      prdStats={data.stats}
      prdText={data.document.body ?? "No document text was stored for this PRD."}
    />
  );
}
