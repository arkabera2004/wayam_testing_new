import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileSearch, AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PriorityBadge } from "@/components/status-badge";
import { listProjectsFn } from "@/lib/projects/functions";
import {
  addPrdCasesToTestPlanFn,
  analyzePrdFn,
  type PublicPrdAnalysis,
} from "@/lib/prd-analysis/functions";

export const Route = createFileRoute("/_app/prd-analysis")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: PrdAnalysisPage,
});

const COVERAGE_META = {
  covered: { label: "covered", className: "border-success/30 bg-success/15 text-success" },
  partial: { label: "partial", className: "border-warning/30 bg-warning/15 text-warning" },
  gap: { label: "gap", className: "border-destructive/30 bg-destructive/15 text-destructive" },
} as const;

const TAG_LABEL = {
  "happy-path": "happy path",
  "edge-case": "edge case",
  negative: "negative",
} as const;

function StatTile({
  label,
  value,
  badge,
}: {
  label: string;
  value: string | number;
  badge?: string | undefined;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {badge && (
            <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning">
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PrdAnalysisPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const analyze = useServerFn(analyzePrdFn);
  const addToTestPlan = useServerFn(addPrdCasesToTestPlanFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicPrdAnalysis | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  async function handleAnalyze() {
    if (!projectId || docText.trim().length < 20) return;
    setPending(true);
    setError(null);
    setAdded(null);
    try {
      setResult(await analyze({ data: { projectId, docTitle, docText } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this document");
    } finally {
      setPending(false);
    }
  }

  async function handleAddToTestPlan() {
    if (!result) return;
    setAdding(true);
    try {
      const { addedCount } = await addToTestPlan({ data: { prdAnalysisId: result.id } });
      setAdded(addedCount);
    } finally {
      setAdding(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using PRD analysis.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const gapsAndPartials = result?.requirements.filter((r) => r.coverage !== "covered") ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileSearch className="h-6 w-6" /> PRD Analysis
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste a requirements document. Every proposed test case traces back to the exact
          requirement it came from — and every requirement Parikshan couldn't test as written is
          flagged before anything is generated.
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
              <CardTitle className="text-base">Requirements document</CardTitle>
              <CardDescription>
                If Gemini is unavailable, a heuristic extraction pass runs instead — the feature
                still works either way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
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
                <Input
                  placeholder="Document title (e.g. Express Checkout)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Textarea
                placeholder={
                  "1. Users must verify their email before checkout.\n2. The refund endpoint returns 422 after the 30-day window.\n..."
                }
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                rows={8}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleAnalyze}
                disabled={!projectId || docText.trim().length < 20 || pending}
              >
                {pending ? "Analyzing…" : "Analyze"}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">{result.docTitle}</h2>
                <Badge variant="outline" className="capitalize">
                  {result.source === "gemini" ? "AI-drafted" : "heuristic fallback"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatTile label="Requirements" value={result.stats.requirements} />
                <StatTile label="Testable" value={result.stats.testable} />
                <StatTile label="Cases proposed" value={result.stats.casesProposed} />
                <StatTile
                  label="Ambiguities"
                  value={result.stats.ambiguities}
                  badge={result.stats.ambiguities > 0 ? "review" : undefined}
                />
                <StatTile label="Requirement coverage" value={`${result.stats.coveragePct}%`} />
              </div>

              {gapsAndPartials.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-warning" /> What Parikshan could not
                      test as written
                    </CardTitle>
                    <CardDescription>
                      Reviewed before generating anything, so the gaps are yours to close.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {gapsAndPartials.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{req.id}</span>
                          <Badge
                            variant="outline"
                            className={COVERAGE_META[req.coverage].className}
                          >
                            {COVERAGE_META[req.coverage].label}
                          </Badge>
                          <Badge variant="outline">{req.category}</Badge>
                        </div>
                        <p className="mt-1 text-sm">{req.issue}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Requirements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.requirements.map((req) => (
                    <div key={req.id} className="rounded-lg border border-border/60 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {req.id}
                        </span>
                        <Badge variant="outline" className={COVERAGE_META[req.coverage].className}>
                          {COVERAGE_META[req.coverage].label}
                        </Badge>
                        <Badge variant="outline">{req.category}</Badge>
                      </div>
                      <p className="mt-1 text-sm">{req.text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Proposed test cases</CardTitle>
                    {added === null ? (
                      <Button
                        onClick={handleAddToTestPlan}
                        disabled={adding || result.testCases.length === 0}
                      >
                        {adding ? "Adding…" : "Add cases to test plan"}
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-success">
                        <CheckCircle2 className="h-4 w-4" /> {added} scenario(s) added
                      </span>
                    )}
                  </div>
                  <CardDescription>
                    Each case traces back to the requirement it came from.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.testCases.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No testable requirements found.
                    </p>
                  ) : (
                    result.testCases.map((tc, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{tc.title}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{tc.requirementId}</Badge>
                            <Badge variant="outline">{TAG_LABEL[tc.tag]}</Badge>
                            <PriorityBadge priority={tc.priority} />
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{tc.description}</p>
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
