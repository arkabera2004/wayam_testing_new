import { currentUserId } from "@/lib/auth";
import { listProjectsWithStats, passRateTrend, workspaceStats } from "@/db/queries";

import { ProjectsTable } from "./projects-table";

/**
 * Server component: reads the database directly rather than fetching its own
 * API route, which would be an extra network hop for data already available
 * in-process. The API routes exist for client callers.
 */
export default async function ProjectsPage() {
  const userId = await currentUserId();
  const [projects, stats, trend] = await Promise.all([
    listProjectsWithStats(userId),
    workspaceStats(userId),
    // Workspace-wide: null project means every suite the user owns.
    passRateTrend(userId, null),
  ]);
  return <ProjectsTable projects={projects} stats={stats} trend={trend} />;
}
