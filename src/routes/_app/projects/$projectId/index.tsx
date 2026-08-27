import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Github, Link2, Pencil, PlayCircle, X, Code2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import {
  getProjectTestPlanFn,
  updateScenarioDescriptionFn,
  updateScenarioStatusFn,
  type PublicScenario,
} from "@/lib/scenarios/functions";

export const Route = createFileRoute("/_app/projects/$projectId/")({
  loader: ({ params }) => getProjectTestPlanFn({ data: { projectId: params.projectId } }),
  component: ProjectTestPlanPage,
});

const TYPE_ORDER: PublicScenario["type"][] = [
  "E2E",
  "API",
  "Regression",
  "Accessibility",
  "Visual",
];

function ProjectTestPlanPage() {
  const { project, scenarios: initialScenarios } = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const updateStatus = useServerFn(updateScenarioStatusFn);
  const updateDescription = useServerFn(updateScenarioDescriptionFn);

  const [scenarios, setScenarios] = useState<PublicScenario[]>(initialScenarios);
  const [editing, setEditing] = useState<PublicScenario | null>(null);
  const [draft, setDraft] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<PublicScenario["type"], PublicScenario[]>();
    for (const type of TYPE_ORDER) map.set(type, []);
    for (const scenario of scenarios) {
      map.get(scenario.type)?.push(scenario);
    }
    return map;
  }, [scenarios]);

  const acceptedCount = scenarios.filter((s) => s.status === "accepted").length;

  async function setStatus(id: string, status: PublicScenario["status"]) {
    const previous = scenarios;
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    try {
      await updateStatus({ data: { scenarioId: id, status } });
      if (status === "accepted") toast.success("Scenario accepted");
      if (status === "rejected") toast("Scenario rejected");
    } catch (err) {
      setScenarios(previous);
      toast.error(err instanceof Error ? err.message : "Could not update scenario");
    }
  }

  function openEdit(scenario: PublicScenario) {
    setEditing(scenario);
    setDraft(scenario.description);
  }

  async function saveEdit() {
    if (!editing) return;
    const id = editing.id;
    try {
      await updateDescription({ data: { scenarioId: id, description: draft } });
      setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, description: draft } : s)));
      toast.success("Scenario updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {project.sourceType === "github" ? (
              <Github className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {project.sourceUrl} · {scenarios.length} scenarios · {acceptedCount} accepted
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/projects/$projectId/runs" params={{ projectId }}>
            <PlayCircle className="h-4 w-4" /> View runs
          </Link>
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <Card className="border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No scenarios yet for this project's test plan.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {TYPE_ORDER.map((type) => {
            const items = grouped.get(type) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={type} className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {type} <span className="text-muted-foreground/60">({items.length})</span>
                </h2>
                <div className="space-y-3">
                  {items.map((scenario) => (
                    <Card key={scenario.id} className="border-border/60">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{scenario.title}</CardTitle>
                            <CardDescription>{scenario.description}</CardDescription>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <PriorityBadge priority={scenario.priority} />
                            <StatusBadge status={scenario.status} />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
                        <Button
                          size="sm"
                          variant={scenario.status === "accepted" ? "secondary" : "outline"}
                          onClick={() => setStatus(scenario.id, "accepted")}
                        >
                          <Check className="h-3.5 w-3.5" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(scenario)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(scenario.id, "rejected")}
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                        {scenario.status === "accepted" && (
                          <Button size="sm" className="ml-auto" asChild>
                            <Link
                              to="/projects/$projectId/cases/$caseId"
                              params={{ projectId, caseId: scenario.id }}
                            >
                              <Code2 className="h-3.5 w-3.5" /> Generate code
                            </Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.title}</DialogTitle>
            <DialogDescription>Edit the plain-English scenario description.</DialogDescription>
          </DialogHeader>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
