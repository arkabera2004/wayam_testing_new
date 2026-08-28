import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProjectsFn } from "@/lib/projects/functions";
import { predictDefectsFn, type DefectPredictionReport } from "@/lib/defect-prediction/functions";

export const Route = createFileRoute("/_app/defect-prediction")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects: projects.filter((p) => p.sourceType === "github") };
  },
  component: DefectPredictionPage,
});

function riskTone(score: number) {
  if (score >= 60) return "border-destructive/30 bg-destructive/15 text-destructive";
  if (score >= 30) return "border-warning/30 bg-warning/15 text-warning";
  return "border-success/30 bg-success/15 text-success";
}

function DefectPredictionPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const predict = useServerFn(predictDefectsFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DefectPredictionReport | null>(null);

  async function handleAnalyze() {
    if (!projectId) return;
    setPending(true);
    setError(null);
    try {
      setReport(await predict({ data: { projectId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this repository");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using defect prediction.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bug className="h-6 w-6" /> Defect Prediction
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-file risk scores from recent commit history — files that break often and get touched
          often rank highest.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Add a GitHub-sourced project first — defect prediction reads its commit history.
          </p>
          <Button asChild>
            <Link to="/projects/new">Add a project</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analyze</CardTitle>
              <CardDescription>
                Scans the most recent commits (bounded to stay within GitHub's API rate limit — add
                GITHUB_TOKEN for a higher ceiling).
              </CardDescription>
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
              <Button onClick={handleAnalyze} disabled={!projectId || pending}>
                {pending ? "Analyzing…" : "Analyze"}
              </Button>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {report && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Highest-risk files</CardTitle>
                <CardDescription>From {report.commitsAnalyzed} recent commit(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {report.files.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No file changes found in the analyzed commits.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Changes</TableHead>
                        <TableHead>Bug fixes</TableHead>
                        <TableHead>Authors</TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.files.map((f) => (
                        <TableRow key={f.filename}>
                          <TableCell className="font-mono text-xs">{f.filename}</TableCell>
                          <TableCell>{f.changeCount}</TableCell>
                          <TableCell>{f.bugFixCount}</TableCell>
                          <TableCell>{f.authorCount}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={riskTone(f.riskScore)}>
                              {f.riskScore}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
