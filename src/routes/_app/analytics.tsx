import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
import { coverageByArea, trend, flakyTests } from "@/features/data/seed";

export const Route = createFileRoute("/_app/analytics")({
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
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coverage &amp; Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Coverage by area, pass/fail trends, and the flaky-test leaderboard across your org.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage by area</CardTitle>
            <CardDescription>Percentage of scenarios covered per feature area</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={coverageConfig} className="h-[260px] w-full">
              <BarChart data={coverageByArea} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="area" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="coverage" fill="var(--color-coverage)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pass / fail trend</CardTitle>
            <CardDescription>Last 7 days across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[260px] w-full">
              <LineChart data={trend} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="passed" type="monotone" stroke="var(--color-passed)" strokeWidth={2} dot={false} />
                <Line dataKey="failed" type="monotone" stroke="var(--color-failed)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk score by area</CardTitle>
          <CardDescription>Higher risk = lower coverage combined with recent failures</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Risk score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverageByArea.map((row) => (
                <TableRow key={row.area}>
                  <TableCell className="font-medium">{row.area}</TableCell>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flaky-test leaderboard</CardTitle>
          <CardDescription>Tests with inconsistent results across recent runs</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Flips (last 14 runs)</TableHead>
                <TableHead>Flake rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flakyTests.map((test) => (
                <TableRow key={test.name}>
                  <TableCell className="font-medium">{test.name}</TableCell>
                  <TableCell className="text-muted-foreground">{test.project}</TableCell>
                  <TableCell>{test.flips}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning">
                      {test.rate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
