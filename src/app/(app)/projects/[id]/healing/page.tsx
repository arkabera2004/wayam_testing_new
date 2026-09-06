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
  return (
    <HealingView
      id={id}
      /*
       * The project's own base URL, because that is where its application
       * runs. This used to be a constant pointing at port 3000, which stopped
       * being true the moment the storefront moved into its own process on
       * 4000: the healer dutifully opened Parikshan, found no such page, and
       * reported that it could not repair the selector. It was reading the
       * wrong application, not failing to read the right one.
       *
       * A project with no base URL gets an empty field rather than a
       * plausible-looking default, so it asks where the application runs
       * instead of quietly looking somewhere it does not.
       */
      defaultUrl={project.baseUrl ?? ""}
      events={events}
      stats={stats}
    />
  );
}
