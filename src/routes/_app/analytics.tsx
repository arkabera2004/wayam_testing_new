import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
import { Badge } from "@/components/ui/badge";
import { getOrgAnalyticsFn } from "@/lib/analytics/functions";

export const Route = createFileRoute("/_app/analytics")({
  loader: async ({ context }) => {
    if (!context.org) return null;
    return getOrgAnalyticsFn({ data: { orgId: context.org.id } });
  },
  component: AnalyticsPage,
});

const coverageConfig = {
  coverage: { label: "Coverage %", color: "var(--chart-1)" },
} satisfies ChartConfig;

const trendConfig = {
  passed: { label: "Passed", color: "var(--chart-1)" },
  failed: { label: "Failed", color: "var(--chart-2)" },
} satisfies ChartConfig;

function riskTone(risk: number) {
  if (risk >= 60) return "bg-destructive/15 text-destructive border-destructive/30";
  if (risk >= 30) return "bg-warning/15 text-warning border-warning/30";
  return "bg-success/15 text-success border-success/30";
}

function AnalyticsPage() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coverage &amp; Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Coverage by scenario type, pass/fail trends, and the flaky-test leaderboard across your
          org.
        </p>
      </div>

      {!org || !data ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before viewing analytics.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coverage by scenario type</CardTitle>
                <CardDescription>
                  Share of scenarios accepted, per type, across all projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.coverageByType.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No scenarios yet.
                  </p>
                ) : (
                  <ChartContainer config={coverageConfig} className="h-[260px] w-full">
                    <BarChart data={data.coverageByType} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="type" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {/* isAnimationActive={false}: Recharts' default mount
                          animation for <Bar> would sometimes never finish
                          populating the bar shapes (rectangleGroups mount
                          empty, permanently) once the app had more
                          concurrent state updates in flight on first paint
                          (extra sidebar nav items, the theme toggle's
                          effect). Static bars render immediately and
                          reliably instead. */}
                      <Bar
                        dataKey="coverage"
                        fill="var(--color-coverage)"
                        radius={4}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pass / fail trend</CardTitle>
                <CardDescription>Last 7 days across all projects</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={trendConfig} className="h-[260px] w-full">
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Risk score by scenario type</CardTitle>
              <CardDescription>
                Higher risk = lower acceptance coverage combined with a lower recent pass rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.coverageByType.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No scenarios yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Risk score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.coverageByType.map((row) => (
                      <TableRow key={row.type}>
                        <TableCell className="font-medium">{row.type}</TableCell>
                        <TableCell>{row.coverage}%</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={riskTone(row.risk)}>
                            {row.risk}
                          </Badge>
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
              <CardTitle className="text-base">Flaky-test leaderboard</CardTitle>
              <CardDescription>
                Tests whose status flipped between passed/failed across their last 14 runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.flakyTests.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No flaky tests detected yet — run a project's tests a few times to see any
                  inconsistent results here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Flips</TableHead>
                      <TableHead>Flake rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.flakyTests.map((test) => (
                      <TableRow key={`${test.projectName}-${test.scenarioTitle}`}>
                        <TableCell className="font-medium">{test.scenarioTitle}</TableCell>
                        <TableCell className="text-muted-foreground">{test.projectName}</TableCell>
                        <TableCell>{test.flips}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-warning/30 bg-warning/15 text-warning"
                          >
                            {test.rate}%
                          </Badge>
                        </TableCell>
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
