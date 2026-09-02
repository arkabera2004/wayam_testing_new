import { currentUserId } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { listApiKeys, workspaceStats } from "@/db/queries";

import { WorkspaceSettingsView, type ApiKeyRow } from "./settings-view";

export default async function WorkspaceSettingsPage() {
  const userId = await currentUserId();

  const [keys, totals] = await Promise.all([listApiKeys(userId), workspaceStats(userId)]);

  const rows: ApiKeyRow[] = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    // Formatted server-side so the markup matches on hydration.
    createdLabel: k.createdAt ? relativeTime(k.createdAt) : "",
    lastUsedLabel: k.lastUsedAt ? relativeTime(k.lastUsedAt) : "never",
    revoked: Boolean(k.revokedAt),
  }));

  return (
    <WorkspaceSettingsView
      workspaceName="Local workspace"
      // Authentication is off, so there is exactly one identity: the tenant
      // everything runs as. Inventing colleagues here would be a lie.
      members={[{ id: userId, name: userId, initials: userId.slice(0, 2).toUpperCase(), role: "Owner" }]}
      initialKeys={rows}
      testMinutes={Math.round(totals.testMs / 60000)}
      runCount={totals.runs}
    />
  );
}
