import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderKanban,
  FlaskConical,
  AlertTriangle,
  ArrowRight,
  Activity,
  Plug,
  ListFilter,
  GitBranch,
  ShieldCheck,
  BookOpen,
  Database,
  Bug,
  ScanSearch,
  FileSearch,
  Wrench,
  ShieldOff,
} from "lucide-react";
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

const SUITE_MODULES = [
  {
    to: "/test-selection",
    icon: ListFilter,
    title: "Test Selection",
    description: "Skip the full suite — run only what a change actually touches.",
  },
  {
    to: "/code-impact",
    icon: GitBranch,
    title: "Code Impact",
    description: "Per-file blast radius and risk before you merge.",
  },
  {
    to: "/ci-intelligence",
    icon: Activity,
    title: "CI Intelligence",
    description: "Pass rate, duration, and trigger breakdown over time.",
  },
  {
    to: "/release-gate",
    icon: ShieldCheck,
    title: "Release Gate",
    description: "A go / no-go verdict scored from real project health.",
  },
  {
    to: "/doc-tests",
    icon: BookOpen,
    title: "Doc Tests",
    description: "Turn documentation requirements into test scenarios.",
  },
  {
    to: "/synthetic-data",
    icon: Database,
    title: "Synthetic Data",
    description: "Realistic JSON test records for any scenario.",
  },
  {
    to: "/defect-prediction",
    icon: Bug,
    title: "Defect Prediction",
    description: "Which files are riskiest, from real commit history.",
  },
  {
    to: "/repo-baseline",
    icon: ScanSearch,
    title: "Repo Baseline",
    description: "A structural snapshot before drafting a test plan.",
  },
  {
    to: "/prd-analysis",
    icon: FileSearch,
    title: "PRD Analysis",
    description: "Traced test cases from a requirements document.",
  },
  {
    to: "/self-healing",
    icon: Wrench,
    title: "Self-Healing",
    description: "Every locator fix Parikshan has proposed, org-wide.",
  },
  {
    to: "/quarantine",
    icon: ShieldOff,
    title: "Quarantine",
    description: "Flaky tests pulled out of release-gate blocking.",
  },
] as const;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Runs (7d)
                </CardDescription>
                <CardTitle className="font-display text-3xl">{data.totals.runsLast7Days}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Plug className="h-4 w-4" /> Integrations
                </CardDescription>
                <CardTitle className="font-display text-3xl">
                  {data.totals.integrationsConnected}
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
                  <p className="py-4 text-center text-sm text-muted-foreground">No projects yet.</p>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Latest test runs across your org</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentRuns.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No runs yet — trigger one from a project's test plan.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      to="/projects/$projectId/runs"
                      params={{ projectId: run.projectId }}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <StatusBadge status={run.status} />
                        <span className="font-medium">{run.projectName}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {run.trigger.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(run.startedAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold tracking-tight">Testing &amp; Quality Suite</h2>
              <p className="text-sm text-muted-foreground">The full toolkit, one click away.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SUITE_MODULES.map((mod) => (
                <Link key={mod.to} to={mod.to}>
                  <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/50">
                    <CardHeader>
                      <mod.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-sm">{mod.title}</CardTitle>
                      <CardDescription className="text-xs">{mod.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
