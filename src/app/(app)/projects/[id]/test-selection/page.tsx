import { notFound } from "next/navigation";

import { PageBody } from "@/components/layout/app-shell";
import { Card, PageHeader } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { resolveProject, testSelectionForLatestDiff } from "@/db/queries";

import { TestSelectionView } from "./test-selection-view";

export default async function TestSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const result = await testSelectionForLatestDiff(userId, project.id);

  // With no recorded diff there is nothing to select against. Say that instead
  // of showing a selection derived from no change at all.
  if (!result.selection || !result.summary) {
    return (
      <PageBody>
        <PageHeader
          title="Test Selection"
          description="Skip the full suite. Parikshan maps changed files to the tests that cover them, explains why, and runs only what matters."
        />
        <Card title="No diff recorded">
          <p className="text-body-md text-tertiary">
            Selection needs a change to reason about. Once a commit range is recorded for this
            project, the tests it affects appear here.
          </p>
        </Card>
      </PageBody>
    );
  }

  return (
    <TestSelectionView
      id={id}
      selection={{
        oldSha: result.selection.oldSha,
        newSha: result.selection.newSha,
        diffAvailable: result.changedFiles.length > 0,
        changedFiles: result.changedFiles,
        selected: result.selected,
        // The page shows a sample of what was skipped, not the whole list.
        skippedSample: result.skipped.slice(0, 4),
        summary: result.summary,
      }}
    />
  );
}
