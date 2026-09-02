import { notFound } from "next/navigation";

import { projectUsage, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { ProjectSettingsView } from "./settings-view";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const usage = await projectUsage(userId, project.id);

  return (
    <ProjectSettingsView
      id={id}
      project={project}
      testMinutes={Math.round(usage.testMs / 60000)}
      runCount={usage.runs}
    />
  );
}
