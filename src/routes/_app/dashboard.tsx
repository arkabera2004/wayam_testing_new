import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, FlaskConical, AlertTriangle, ArrowRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { StatusBadge } from "@/components/status-badge";
import { projects, scenarios, trend, flakyTests } from "@/features/data/seed";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const chartConfig = {
  passed: { label: "Passed", color: "var(--chart-1)" },
  failed: { label: "Failed", color: "var(--chart-2)" },
} satisfies ChartConfig;

function DashboardPage() {
  const totalTests = scenarios.length;
  const recentProjects = [...projects]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          An overview of your organization's testing activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" /> Total projects
            </CardDescription>
            <CardTitle className="font-display text-3xl">{projects.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Tests generated
            </CardDescription>
            <CardTitle className="font-display text-3xl">{totalTests}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Flaky tests
            </CardDescription>
            <CardTitle className="font-display text-3xl">{flakyTests.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. coverage</CardDescription>
            <CardTitle className="font-display text-3xl">
              {Math.round(projects.reduce((sum, p) => sum + p.coverage, 0) / projects.length)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pass / fail trend</CardTitle>
            <CardDescription>Last 7 days across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <LineChart data={trend} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="passed"
                  type="monotone"
                  stroke="var(--color-passed)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="failed"
                  type="monotone"
                  stroke="var(--color-failed)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent projects</CardTitle>
            <CardDescription>Jump back into recent work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:bg-accent"
              >
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.coverage}% coverage</p>
                </div>
                <StatusBadge status={project.lastRunStatus} />
              </Link>
            ))}
            <Button variant="ghost" className="w-full justify-between" asChild>
              <Link to="/projects">
                View all projects <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
