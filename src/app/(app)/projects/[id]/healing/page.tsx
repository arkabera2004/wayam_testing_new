import { notFound } from "next/navigation";

import { listHealingEvents, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { HealingView } from "./healing-view";

export default async function HealingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const { events, stats } = await listHealingEvents(userId, project.id);
  return <HealingView id={id} events={events} stats={stats} />;
}
