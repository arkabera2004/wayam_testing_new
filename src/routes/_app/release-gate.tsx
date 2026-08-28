import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProjectsFn } from "@/lib/projects/functions";
import { evaluateReleaseGateFn } from "@/lib/release-gate/functions";
import type { GateVerdict, ReleaseGateReport } from "@/lib/release-gate/evaluate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/release-gate")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: ReleaseGatePage,
});

const VERDICT_META: Record<
  GateVerdict,
  { label: string; icon: typeof ShieldCheck; className: string }
> = {
  go: { label: "Go", icon: ShieldCheck, className: "border-success/30 bg-success/15 text-success" },
  go_with_caution: {
    label: "Go with caution",
    icon: ShieldAlert,
    className: "border-warning/30 bg-warning/15 text-warning",
  },
  no_go: {
    label: "No go",
    icon: ShieldX,
    className: "border-destructive/30 bg-destructive/15 text-destructive",
  },
};

function ReleaseGatePage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const evaluate = useServerFn(evaluateReleaseGateFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReleaseGateReport | null>(null);

  async function handleEvaluate() {
    if (!projectId) return;
    setPending(true);
    setError(null);
    try {
      setReport(await evaluate({ data: { projectId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not evaluate this project");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using the release gate.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const verdictMeta = report ? VERDICT_META[report.verdict] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6" /> Release Gate
        </h1>
        <p className="text-sm text-muted-foreground">
          Is this project ready to ship? Scored from coverage, latest run pass rate, open critical
          scenarios, and flaky tests.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">Add a project first.</p>
          <Button asChild>
            <Link to="/projects/new">Add a project</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evaluate</CardTitle>
              <CardDescription>Pick a project to score against the current gate.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleEvaluate} disabled={!projectId || pending}>
                {pending ? "Evaluating…" : "Evaluate"}
              </Button>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {report && verdictMeta && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={cn("gap-1.5 px-3 py-1.5 text-sm", verdictMeta.className)}
                  >
                    <verdictMeta.icon className="h-4 w-4" />
                    {verdictMeta.label}
                  </Badge>
                  <p className="text-2xl font-semibold tracking-tight">{report.score}/100</p>
                </div>
                {report.blockingReasons.length === 0 ? (
                  <p className="text-sm text-success">No blocking issues found.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {report.blockingReasons.map((reason, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
