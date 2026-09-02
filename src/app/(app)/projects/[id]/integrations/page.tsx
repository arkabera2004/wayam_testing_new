import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth";
import { repoFullName } from "@/lib/github";
import { getGithubConnection, resolveProject } from "@/db/queries";

import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const conn = await getGithubConnection(userId);

  return (
    <IntegrationsClient
      github={{
        connected: Boolean(conn),
        username: conn?.githubUsername ?? null,
        // Formatted here so the server and client markup agree on hydration.
        connectedAtLabel: conn?.connectedAt
          ? `connected ${conn.connectedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
          : null,
        linkedRepo: repoFullName(project.githubRepoUrl),
      }}
    />
  );
}
