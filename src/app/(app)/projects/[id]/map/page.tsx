import { notFound } from "next/navigation";

import { discoverySummary, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { MapView } from "./map-view";

export default async function ApplicationMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const { pages, endpoints, stats } = await discoverySummary(userId, project.id);
  return <MapView id={id} pages={pages} endpoints={endpoints} stats={stats} />;
}
