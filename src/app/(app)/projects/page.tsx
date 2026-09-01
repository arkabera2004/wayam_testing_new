import { currentUserId } from "@/lib/auth";
import { listProjectsWithStats } from "@/db/queries";

import { ProjectsTable } from "./projects-table";

/**
 * Server component: reads the database directly rather than fetching its own
 * API route, which would be an extra network hop for data already available
 * in-process. The API routes exist for client callers.
 */
export default async function ProjectsPage() {
  const userId = await currentUserId();
  const projects = await listProjectsWithStats(userId);
  return <ProjectsTable projects={projects} />;
}
