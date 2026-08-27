import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RotateCcw, ImageOff, Loader2, Wand2 } from "lucide-react";
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
import { getRunDetailFn, rerunFailedFn } from "@/lib/runs/functions";

export const Route = createFileRoute("/_app/projects/$projectId/runs/$runId")({
  loader: ({ params }) => getRunDetailFn({ data: { runId: params.runId } }),
  component: RunDetailPage,
});

function RunDetailPage() {
  const initial = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const rerunFailed = useServerFn(rerunFailedFn);

  const [run] = useState(initial.run);
  const [results] = useState(initial.results);
  const [rerunning, setRerunning] = useState(false);

  const failedCount = results.filter((r) => r.status === "failed").length;

  async function handleRerunFailed() {
    setRerunning(true);
    try {
      const newRun = await rerunFailed({ data: { runId: run.id } });
      toast.success(`Re-run complete: ${newRun.passed} passed, ${newRun.failed} failed`, {
        description: "See it in the runs list.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not re-run failed tests");
    } finally {
      setRerunning(false);
    }
  }

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
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              {run.id.slice(-8)}
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.passed} passed · {run.failed} failed · {Math.round(run.durationMs / 1000)}s
          </p>
        </div>
        {failedCount > 0 && (
          <Button variant="outline" onClick={handleRerunFailed} disabled={rerunning}>
            {rerunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Re-run failed only
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step-by-step results</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test cases were included in this run.</p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {results.map((result) => (
                <AccordionItem
                  key={result.id}
                  value={result.id}
                  className="rounded-lg border border-border/60 px-4"
                >
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <span className="text-sm font-medium">{result.scenarioTitle}</span>
                      <StatusBadge status={result.status} />
                    </div>
                  </AccordionTrigger>
                  {result.status === "failed" && (
                    <AccordionContent className="space-y-3 text-sm">
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                        {result.errorMessage}
                      </div>
                      {result.healedSelector && (
                        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-xs">
                          <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              Self-healing agent proposed a replacement selector
                            </p>
                            <code className="block font-mono text-muted-foreground">
                              {result.healedSelector}
                            </code>
                            {result.healNote && (
                              <p className="text-muted-foreground">{result.healNote}</p>
                            )}
                            <p className="text-muted-foreground">
                              Not applied automatically — review the test case's generated code
                              to accept this fix.
                            </p>
                          </div>
                        </div>
                      )}
                      <details className="rounded-md border border-border/60 bg-secondary/30 p-3">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          Stack trace
                        </summary>
                        <pre className="mt-2 overflow-x-auto font-mono text-xs text-muted-foreground">
{`at ${result.filePath ?? "unknown"}:24:18
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
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
