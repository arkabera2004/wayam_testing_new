import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getProjectTestPlanFn, type PublicScenario } from "@/lib/scenarios/functions";
import {
  generateSyntheticDataFn,
  type PublicSyntheticDataRun,
} from "@/lib/synthetic-data/functions";

export const Route = createFileRoute("/_app/synthetic-data")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: SyntheticDataPage,
});

function SyntheticDataPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const loadScenarios = useServerFn(getProjectTestPlanFn);
  const generate = useServerFn(generateSyntheticDataFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [scenarios, setScenarios] = useState<PublicScenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [count, setCount] = useState(5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicSyntheticDataRun | null>(null);

  async function loadScenariosFor(id: string) {
    if (!id) {
      setScenarios([]);
      return;
    }
    const { scenarios: loaded } = await loadScenarios({ data: { projectId: id } });
    setScenarios(loaded);
  }

  // Load scenarios for the project that's already selected on mount (the
  // first project in the list) — handleProjectChange alone only fires on
  // a user-driven Select change, which never happens for the default
  // value, so the scenario dropdown was stuck empty until you manually
  // re-picked the already-selected project.
  useEffect(() => {
    loadScenariosFor(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProjectChange(id: string) {
    setProjectId(id);
    setScenarioId("");
    setResult(null);
    await loadScenariosFor(id);
  }

  async function handleGenerate() {
    if (!scenarioId) return;
    setPending(true);
    setError(null);
    try {
      setResult(await generate({ data: { scenarioId, count } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate synthetic data");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using synthetic data.
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
          <Database className="h-6 w-6" /> Synthetic Data
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate realistic JSON test records for a scenario — grounded in its own
          title/description, not fabricated at random.
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
              <CardTitle className="text-base">Scenario</CardTitle>
              <CardDescription>Pick a project, then one of its scenarios.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <Select value={projectId} onValueChange={handleProjectChange}>
                <SelectTrigger className="w-full sm:w-56">
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
              <Select value={scenarioId} onValueChange={setScenarioId}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-24"
              />
              <Button onClick={handleGenerate} disabled={!scenarioId || pending}>
                {pending ? "Generating…" : "Generate"}
              </Button>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{result.scenarioTitle}</CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {result.source === "gemini" ? "AI-generated" : "heuristic fallback"}
                  </Badge>
                </div>
                <CardDescription>{result.records.length} record(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded-lg border border-border/60 bg-secondary/20 p-4 font-mono text-xs">
                  {JSON.stringify(result.records, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
