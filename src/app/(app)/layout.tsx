import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { currentUser } from "@clerk/nextjs/server";

import { currentUserId } from "@/lib/auth";
import { listProjectsWithStats } from "@/db/queries";

/**
 * Loads the sidebar's counts once for every page under this layout. They used
 * to come from the demo dataset, which meant the badge could claim 42 tests
 * while the page below it listed 10.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const userId = await currentUserId();
  const [projects, user] = await Promise.all([listProjectsWithStats(userId), currentUser()]);

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";
  const active = projects[0] ?? null;

  return (
    <AppShell
      projects={projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }))}
      activeProject={active ? { name: active.name, slug: active.slug, tests: active.tests } : null}
      user={{
        name,
        email: user?.primaryEmailAddress?.emailAddress ?? "",
        initials: name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?",
      }}
    >
      {children}
    </AppShell>
  );
}
