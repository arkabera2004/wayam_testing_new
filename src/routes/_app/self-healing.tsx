import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Wrench, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyHealFn,
  listRecentHealsFn,
  type PublicHealSuggestion,
} from "@/lib/self-healing/functions";

export const Route = createFileRoute("/_app/self-healing")({
  loader: async ({ context }) => {
    if (!context.org) return { heals: [] };
    const heals = await listRecentHealsFn({ data: { orgId: context.org.id } });
    return { heals };
  },
  component: SelfHealingPage,
});

function confidenceTone(note: string | null): string {
  if (!note) return "border-border bg-muted text-muted-foreground";
  if (note.startsWith("[high")) return "border-success/30 bg-success/15 text-success";
  if (note.startsWith("[medium")) return "border-warning/30 bg-warning/15 text-warning";
  return "border-destructive/30 bg-destructive/15 text-destructive";
}

function SelfHealingPage() {
  const { org } = Route.useRouteContext();
  const { heals: initialHeals } = Route.useLoaderData();
  const apply = useServerFn(applyHealFn);

  const [heals, setHeals] = useState<PublicHealSuggestion[]>(initialHeals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(runResultId: string) {
    setPendingId(runResultId);
    setError(null);
    try {
      await apply({ data: { runResultId } });
      setHeals((prev) =>
        prev.map((h) => (h.runResultId === runResultId ? { ...h, applied: true } : h)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply this fix");
    } finally {
      setPendingId(null);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before viewing self-healing.
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
          <Wrench className="h-6 w-6" /> Self-Healing
        </h1>
        <p className="text-sm text-muted-foreground">
          Every locator fix Parikshan has proposed across your org, from URL-sourced projects'
          failed runs. Apply annotates the real test case code — nothing changes automatically.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {heals.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No heal suggestions yet — these appear after a failed run on a Live URL project is
            re-run with "Re-run failed only."
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {heals.map((heal) => (
            <Card key={heal.runResultId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{heal.scenarioTitle}</CardTitle>
                    <CardDescription>{heal.projectName}</CardDescription>
                  </div>
                  <Badge variant="outline" className={confidenceTone(heal.healNote)}>
                    {heal.healNote?.match(/^\[(\w+) confidence\]/)?.[1] ?? "unknown"} confidence
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 font-mono text-xs">
                  {heal.healedSelector}
                </p>
                {heal.healNote && (
                  <p className="text-xs text-muted-foreground">
                    {heal.healNote.replace(/^\[\w+ confidence\]\s*/, "")}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  {heal.applied ? (
                    <span className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Applied to test case
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleApply(heal.runResultId)}
                      disabled={pendingId === heal.runResultId}
                    >
                      {pendingId === heal.runResultId ? "Applying…" : "Apply fix"}
                    </Button>
                  )}
                  <Link
                    to="/projects/$projectId/runs/$runId"
                    params={{ projectId: heal.projectId, runId: heal.runId }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    View run
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
