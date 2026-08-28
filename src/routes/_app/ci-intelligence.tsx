import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Clock, GitPullRequest, Gauge } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getCiIntelligenceFn } from "@/lib/ci-intelligence/functions";

export const Route = createFileRoute("/_app/ci-intelligence")({
  loader: async ({ context }) => {
    if (!context.org) return null;
    return getCiIntelligenceFn({ data: { orgId: context.org.id } });
  },
  component: CiIntelligencePage,
});

const trendConfig = {
  passed: { label: "Passed", color: "var(--chart-1)" },
  failed: { label: "Failed", color: "var(--chart-2)" },
} satisfies ChartConfig;

function formatMs(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CiIntelligencePage() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Activity className="h-6 w-6" /> CI Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          Pass rate, duration, and trigger breakdown across every test run in your org.
        </p>
      </div>

      {!org || !data ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before viewing CI intelligence.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile icon={Activity} label="Total runs" value={data.totalRuns} />
            <StatTile icon={Gauge} label="Overall pass rate" value={`${data.overallPassRate}%`} />
            <StatTile icon={Clock} label="Avg. duration" value={formatMs(data.avgDurationMs)} />
            <StatTile icon={GitPullRequest} label="Triggers seen" value={data.byTrigger.length} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pass / fail trend</CardTitle>
              <CardDescription>Last 7 days across all projects</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="h-[240px] w-full">
                <AreaChart data={data.trend} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="passed"
                    type="monotone"
                    stroke="var(--color-passed)"
                    fill="var(--color-passed)"
                    fillOpacity={0.15}
                  />
                  <Area
                    dataKey="failed"
                    type="monotone"
                    stroke="var(--color-failed)"
                    fill="var(--color-failed)"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By trigger</CardTitle>
              <CardDescription>Manual runs vs. on-PR vs. scheduled</CardDescription>
            </CardHeader>
            <CardContent>
              {data.byTrigger.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Runs</TableHead>
                      <TableHead>Pass rate</TableHead>
                      <TableHead>Avg. duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byTrigger.map((row) => (
                      <TableRow key={row.trigger}>
                        <TableCell className="font-medium capitalize">
                          {row.trigger.replace("_", " ")}
                        </TableCell>
                        <TableCell>{row.totalRuns}</TableCell>
                        <TableCell>{row.passRate}%</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatMs(row.avgDurationMs)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Slowest test cases</CardTitle>
              <CardDescription>Average duration across their runs</CardDescription>
            </CardHeader>
            <CardContent>
              {data.slowestTests.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No test results yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test</TableHead>
                      <TableHead>Avg. duration</TableHead>
                      <TableHead>Runs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slowestTests.map((row) => (
                      <TableRow key={row.scenarioTitle}>
                        <TableCell className="font-medium">{row.scenarioTitle}</TableCell>
                        <TableCell>{formatMs(row.avgDurationMs)}</TableCell>
                        <TableCell className="text-muted-foreground">{row.runs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
