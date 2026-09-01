import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export type ShellProject = { id: string; name: string; slug: string };
export type ActiveProject = { name: string; slug: string; tests: number };

export function AppShell({
  children,
  projects = [],
  activeProject = null,
}: {
  children: ReactNode;
  projects?: ShellProject[];
  activeProject?: ActiveProject | null;
}) {
  return (
    <div className="bg-page text-primary flex h-screen w-screen overflow-hidden">
      <Sidebar projects={projects} activeProject={activeProject} />
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
