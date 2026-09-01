import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export type ShellProject = { id: string; name: string; slug: string };
export type ActiveProject = { name: string; slug: string; tests: number };
export type ShellUser = { name: string; email: string; initials: string };

export function AppShell({
  children,
  projects = [],
  activeProject = null,
  projectSummaries = [],
  user,
}: {
  children: ReactNode;
  projects?: ShellProject[];
  activeProject?: ActiveProject | null;
  /** Every project's counts, so the sidebar can follow the URL. */
  projectSummaries?: ActiveProject[];
  /** Required: this shell only renders behind a session. */
  user: ShellUser;
}) {
  return (
    <div className="bg-page text-primary flex h-screen w-screen overflow-hidden">
      <Sidebar
        projects={projects}
        activeProject={activeProject}
        projectSummaries={projectSummaries}
        user={user}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/** Standard interior page padding, shared by every authenticated page. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 px-5 py-5">{children}</div>;
}
