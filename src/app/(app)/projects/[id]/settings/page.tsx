import { notFound } from "next/navigation";

import { resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { ProjectSettingsView } from "./settings-view";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  return <ProjectSettingsView id={id} project={project} />;
}
