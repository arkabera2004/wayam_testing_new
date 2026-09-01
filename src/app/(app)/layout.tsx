import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { currentUserId } from "@/lib/auth";
import { listProjectsWithStats } from "@/db/queries";

/**
 * Loads the sidebar's counts once for every page under this layout. They used
 * to come from the demo dataset, which meant the badge could claim 42 tests
 * while the page below it listed 10.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const userId = await currentUserId();
  const projects = await listProjectsWithStats(userId);
  const active = projects[0] ?? null;

  return (
    <AppShell
      projects={projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }))}
      projectSummaries={projects.map((p) => ({ name: p.name, slug: p.slug, tests: p.tests }))}
      activeProject={active ? { name: active.name, slug: active.slug, tests: active.tests } : null}
      user={{ name: "Local", email: "Signed-in user is stubbed", initials: "LO" }}
    >
      {children}
    </AppShell>
  );
}
