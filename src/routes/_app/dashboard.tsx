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
import { getDashboardFn } from "@/lib/dashboard/functions";

export const Route = createFileRoute("/_app/dashboard")({
  loader: async ({ context }) => {
    if (!context.org) return null;
    return getDashboardFn({ data: { orgId: context.org.id } });
  },
  component: DashboardPage,
});

const chartConfig = {
  passed: { label: "Passed", color: "var(--chart-1)" },
  failed: { label: "Failed", color: "var(--chart-2)" },
} satisfies ChartConfig;

function DashboardPage() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          An overview of your organization's testing activity.
        </p>
      </div>

      {!org || !data ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace to see your dashboard.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" /> Total projects
                </CardDescription>
                <CardTitle className="font-display text-3xl">{data.totals.projects}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" /> Tests generated
                </CardDescription>
                <CardTitle className="font-display text-3xl">
                  {data.totals.testsGenerated}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Flaky tests
                </CardDescription>
                <CardTitle className="font-display text-3xl">{data.totals.flakyTests}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg. coverage</CardDescription>
                <CardTitle className="font-display text-3xl">{data.avgCoveragePct}%</CardTitle>
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
                  <LineChart data={data.trend} margin={{ left: 12, right: 12 }}>
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
                {data.recentProjects.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No projects yet.
                  </p>
                ) : (
                  data.recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.coveragePct}% coverage
                        </p>
                      </div>
                      <StatusBadge status={project.lastRunStatus} />
                    </Link>
                  ))
                )}
                <Button variant="ghost" className="w-full justify-between" asChild>
                  <Link to="/projects">
                    View all projects <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
