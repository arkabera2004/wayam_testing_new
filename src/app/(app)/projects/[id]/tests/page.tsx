import { notFound } from "next/navigation";

import { listTestCasesWithStats, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { TestsTable } from "./tests-table";

export default async function TestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const tests = await listTestCasesWithStats(userId, project.id);

  return (
    <TestsTable
      id={id}
      tests={tests}
    />
  );
}
