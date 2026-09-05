import { notFound } from "next/navigation";

import { PageBody } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { listDocTests, resolveProject } from "@/db/queries";

import { DocTestsView, type DocScenarioRow } from "./doc-tests-view";
import { UploadDoc } from "./upload-doc";

function humanSize(bytes: number | null) {
  if (!bytes) return "unknown size";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocTestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const { document, scenarios } = await listDocTests(userId, project.id);

  // No document uploaded yet is a real state, not an error. Say so rather than
  // rendering a page shaped around data that does not exist.
  if (!document) {
    return (
      <PageBody>
        <PageHeader
          title="Tests from documents"
          description="Upload a spec and Parikshan proposes the scenarios it describes."
        />
        <UploadDoc projectId={project.id} />
      </PageBody>
    );
  }

  const rows: DocScenarioRow[] = scenarios.map((s) => ({
    id: s.id,
    title: s.title,
    expectation: s.expectation ?? "",
    source: s.source ?? "",
    tag: (s.tag ?? "happy-path") as DocScenarioRow["tag"],
    selected: s.selected ?? false,
  }));

  return (
    <>
      <PageBody>
        <UploadDoc projectId={project.id} />
      </PageBody>
      <DocTestsView
      document={{
        name: document.name,
        size: humanSize(document.sizeBytes),
        sections: document.sections,
        // Formatted server-side so hydration does not mismatch on a clock read.
        parsedAtLabel: document.parsedAt ? relativeTime(document.parsedAt) : "recently",
      }}
        initialScenarios={rows}
      />
    </>
  );
}
