import { notFound } from "next/navigation";

import { discoverySummary, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { DiscoveryView } from "./discovery-view";

export default async function DiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const { pages, endpoints, stats } = await discoverySummary(userId, project.id);

  return (
    <DiscoveryView
      id={id}
      pages={pages}
      endpoints={endpoints}
      stats={stats}
      targetUrl={project.githubRepoUrl ?? project.description ?? project.name}
    />
  );
}
