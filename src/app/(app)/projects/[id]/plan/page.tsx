import { notFound } from "next/navigation";

import { listTestPlan, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { PlanView } from "./plan-view";

export default async function TestPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const { journeys, stats } = await listTestPlan(userId, project.id);
  return <PlanView id={id} journeys={journeys} stats={stats} />;
}
