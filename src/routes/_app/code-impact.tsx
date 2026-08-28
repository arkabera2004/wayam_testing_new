import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GitBranch, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { analyzeCodeImpactFn } from "@/lib/code-impact/functions";
import type { CodeImpactSummary, RiskTier } from "@/lib/code-impact/analyze";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/code-impact")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: CodeImpactPage,
});

const RISK_STYLE: Record<RiskTier, string> = {
  high: "border-destructive/30 bg-destructive/15 text-destructive",
  medium: "border-warning/30 bg-warning/15 text-warning",
  low: "border-success/30 bg-success/15 text-success",
  unknown: "border-border bg-muted text-muted-foreground",
};

function CodeImpactPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const analyze = useServerFn(analyzeCodeImpactFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [changedFiles, setChangedFiles] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CodeImpactSummary | null>(null);

  async function handleAnalyze() {
    if (!projectId || !changedFiles.trim()) return;
    setPending(true);
    setError(null);
    try {
      setResult(await analyze({ data: { projectId, changedFiles } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this project");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using code impact.
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
          <GitBranch className="h-6 w-6" /> Code Impact
        </h1>
        <p className="text-sm text-muted-foreground">
          Per changed file: which accepted test cases cover it, and how risky it is to touch.
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
              <CardTitle className="text-base">Changed files</CardTitle>
              <CardDescription>One file path per line.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Textarea
                placeholder={"src/checkout.ts\nsrc/lib/pricing.ts"}
                value={changedFiles}
                onChange={(e) => setChangedFiles(e.target.value)}
                rows={5}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleAnalyze}
                disabled={!projectId || !changedFiles.trim() || pending}
              >
                {pending ? "Analyzing…" : "Analyze impact"}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Overall risk</p>
                    <Badge
                      variant="outline"
                      className={cn("mt-1", RISK_STYLE[result.overallRiskTier])}
                    >
                      {result.overallRiskTier}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Affected tests</p>
                    <p className="text-xl font-semibold tracking-tight">
                      {result.totalAffectedTests}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Untested files</p>
                    <p className="text-xl font-semibold tracking-tight">
                      {result.untestedFileCount}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                {result.files.map((file) => (
                  <Card key={file.changedFile}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-sm">{file.changedFile}</p>
                        <Badge variant="outline" className={RISK_STYLE[file.riskTier]}>
                          {file.riskTier}
                        </Badge>
                      </div>
                      {file.affectedTests.length === 0 ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5" /> No accepted test case covers
                          this file.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {file.affectedTests.map((t) => (
                            <li key={t.testCaseId} className="text-xs text-muted-foreground">
                              {t.scenarioTitle}{" "}
                              <span className="text-muted-foreground/70">
                                ({t.scenarioType}, {t.priority})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
