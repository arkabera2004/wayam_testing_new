import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw, ImageOff } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StatusBadge } from "@/components/status-badge";
import { getProject, runs, scenariosFor } from "@/features/data/seed";

export const Route = createFileRoute("/_app/projects/$projectId/runs/$runId")({
  loader: ({ params }) => {
    const project = getProject(params.projectId);
    const run = runs.find((r) => r.id === params.runId);
    if (!project || !run) throw notFound();
    return { project, run, scenarios: scenariosFor(params.projectId) };
  },
  component: RunDetailPage,
});

const FAILING_STATUSES = new Set(["failing", "flaky"]);

function RunDetailPage() {
  const { project, run, scenarios } = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const failedCount = scenarios.filter((s) => FAILING_STATUSES.has(s.caseStatus)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/projects/$projectId/runs" params={{ projectId }}>
          <ArrowLeft className="h-4 w-4" /> Back to runs
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{run.id}</h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.name} · {run.passed} passed · {run.failed} failed ·{" "}
            {Math.round(run.durationMs / 1000)}s
          </p>
        </div>
        {failedCount > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              toast("Re-running failed tests", {
                description: `${failedCount} test case${failedCount === 1 ? "" : "s"} queued.`,
              })
            }
          >
            <RotateCcw className="h-4 w-4" /> Re-run failed only
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step-by-step results</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-2">
            {scenarios.map((scenario) => {
              const isFailing = FAILING_STATUSES.has(scenario.caseStatus);
              return (
                <AccordionItem
                  key={scenario.id}
                  value={scenario.id}
                  className="rounded-lg border border-border/60 px-4"
                >
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <span className="text-sm font-medium">{scenario.title}</span>
                      <StatusBadge status={scenario.caseStatus} />
                    </div>
                  </AccordionTrigger>
                  {isFailing && (
                    <AccordionContent className="space-y-3 text-sm">
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                        Error: expected element to be visible within 5000ms — locator resolved
                        to 0 elements.
                      </div>
                      <details className="rounded-md border border-border/60 bg-secondary/30 p-3">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          Stack trace
                        </summary>
                        <pre className="mt-2 overflow-x-auto font-mono text-xs text-muted-foreground">
{`at ${scenario.filePath}:24:18
at TestCase.run (internal/test-runner.ts:112:5)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5)`}
                        </pre>
                      </details>
                      <div className="flex h-32 items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
                        <ImageOff className="h-4 w-4" /> Screenshot placeholder
                      </div>
                    </AccordionContent>
                  )}
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
