import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ListFilter, Sparkles, Clock, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/status-badge";
import { listProjectsFn } from "@/lib/projects/functions";
import {
  analyzeTestSelectionFn,
  type PublicTestSelectionRun,
} from "@/lib/test-selection/functions";

export const Route = createFileRoute("/_app/test-selection")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: TestSelectionPage,
});

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
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

function TestSelectionPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const analyze = useServerFn(analyzeTestSelectionFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [changedFiles, setChangedFiles] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicTestSelectionRun | null>(null);

  async function handleAnalyze() {
    if (!projectId) return;
    setPending(true);
    setError(null);
    try {
      const run = await analyze({ data: { projectId, changedFiles } });
      setResult(run);
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
            Finish setting up your workspace before using test selection.
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
          <ListFilter className="h-6 w-6" /> Intelligent Test Selection
        </h1>
        <p className="text-sm text-muted-foreground">
          Skip the full suite. Paste the files a change touched and Parikshan ranks the accepted
          test cases that actually cover them.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Add a project first — test selection ranks its accepted test cases.
          </p>
          <Button asChild>
            <Link to="/projects/new">Add a project</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current change</CardTitle>
              <CardDescription>
                Pick a project and paste changed file paths (one per line, e.g. from{" "}
                <code>git diff --name-only</code>). Leave it empty to see the full-suite fallback.
              </CardDescription>
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
                placeholder={"src/checkout.ts\nsrc/components/CartSummary.tsx"}
                value={changedFiles}
                onChange={(e) => setChangedFiles(e.target.value)}
                rows={5}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handleAnalyze} disabled={!projectId || pending}>
                {pending ? "Analyzing…" : "Analyze"}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile icon={Layers} label="Total tests" value={result.totalTests} />
                <StatTile icon={Sparkles} label="Selected" value={result.selectedTests} />
                <StatTile icon={ListFilter} label="Skipped" value={result.skippedTests} />
                <StatTile
                  icon={Clock}
                  label="Est. savings"
                  value={`${result.estimatedSavingsPct}%`}
                />
              </div>

              {!result.diffAvailable && (
                <Card className="border-warning/30 bg-warning/5">
                  <CardContent className="pt-6 text-sm text-warning">
                    No changed files were given, so the full suite was selected as a safe fallback.
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranked test cases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.candidates.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      This project has no accepted, code-generated test cases yet.
                    </p>
                  ) : (
                    result.candidates
                      .slice()
                      .sort((a, b) => b.score - a.score)
                      .map((c) => (
                        <div
                          key={c.testCaseId}
                          className={
                            "rounded-lg border px-4 py-3 " +
                            (c.selected
                              ? "border-border/60 bg-secondary/20"
                              : "border-border/20 opacity-60")
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{c.scenarioTitle}</p>
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority={c.priority} />
                              <span className="text-xs font-semibold text-muted-foreground">
                                score {c.score}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1">
                            {c.reasons.map((r, i) => (
                              <p
                                key={i}
                                className={
                                  "text-xs " +
                                  (r.matched ? "text-success" : "text-muted-foreground")
                                }
                              >
                                {r.matched ? "✓" : "○"} {r.label}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
