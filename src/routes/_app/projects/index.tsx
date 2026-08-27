import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Link2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { listProjectsFn } from "@/lib/projects/functions";

export const Route = createFileRoute("/_app/projects/")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: ProjectsPage,
});

function formatDate(iso: string) {
  // Explicit locale: relying on the runtime default would render
  // differently on the server (Node's default locale) vs. the browser,
  // causing a hydration mismatch.
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ProjectsPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"} connected to Parikshan.
          </p>
        </div>
        {org && (
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4" /> New project
            </Link>
          </Button>
        )}
      </div>

      {!org ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before adding a project.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4" /> Add your first project
            </Link>
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      className="hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      {project.sourceType === "github" ? (
                        <Github className="h-3.5 w-3.5" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      {project.sourceUrl}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.lastRunStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.coveragePct}%</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(project.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
