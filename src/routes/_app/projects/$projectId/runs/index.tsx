import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, GitPullRequest, Clock, MousePointerClick, PlayCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { listRunsFn, triggerRunFn, type PublicRun } from "@/lib/runs/functions";

export const Route = createFileRoute("/_app/projects/$projectId/runs/")({
  loader: ({ params }) => listRunsFn({ data: { projectId: params.projectId } }),
  component: RunsListPage,
});

const TRIGGER_ICON = {
  manual: MousePointerClick,
  on_pr: GitPullRequest,
  scheduled: Clock,
} as const;

const TRIGGER_LABEL = {
  manual: "Manual",
  on_pr: "On pull request",
  scheduled: "Scheduled",
} as const;

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatTimestamp(iso: string) {
  // Explicit locale: relying on the runtime default would render
  // differently on the server (Node's default locale) vs. the browser,
  // causing a hydration mismatch.
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RunsListPage() {
  const initialRuns = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const triggerRun = useServerFn(triggerRunFn);
  const [runs, setRuns] = useState<PublicRun[]>(initialRuns);
  const [running, setRunning] = useState(false);

  async function handleRunNow() {
    setRunning(true);
    try {
      const run = await triggerRun({ data: { projectId } });
      setRuns((prev) => [run, ...prev]);
      toast.success(
        run.status === "passed"
          ? "Run passed"
          : run.status === "flaky"
            ? "Run completed with flaky results"
            : "Run failed",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start run");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/projects/$projectId" params={{ projectId }}>
          <ArrowLeft className="h-4 w-4" /> Back to test plan
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test runs</h1>
          <p className="text-sm text-muted-foreground">
            {runs.length} run{runs.length === 1 ? "" : "s"} for this project
          </p>
        </div>
        <Button onClick={handleRunNow} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run now
        </Button>
      </div>

      {runs.length === 0 ? (
        <Card className="border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No runs yet. Accept a scenario and generate its code, then run it here.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Pass / fail</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const TriggerIcon = TRIGGER_ICON[run.trigger];
                return (
                  <TableRow key={run.id} className="cursor-pointer">
                    <TableCell className="font-mono text-sm">
                      <Link
                        to="/projects/$projectId/runs/$runId"
                        params={{ projectId, runId: run.id }}
                        className="hover:underline"
                      >
                        {run.id.slice(-8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <TriggerIcon className="h-3.5 w-3.5" />
                        {TRIGGER_LABEL[run.trigger]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(run.durationMs)}
                    </TableCell>
                    <TableCell>
                      <span className="text-success">{run.passed}</span>
                      {" / "}
                      <span className="text-destructive">{run.failed}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(run.startedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
