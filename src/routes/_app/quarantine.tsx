import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listQuarantinedCasesFn,
  setQuarantineFn,
  type PublicQuarantinedCase,
} from "@/lib/quarantine/functions";

export const Route = createFileRoute("/_app/quarantine")({
  loader: async ({ context }) => {
    if (!context.org) return { cases: [] };
    const cases = await listQuarantinedCasesFn({ data: { orgId: context.org.id } });
    return { cases };
  },
  component: QuarantinePage,
});

function QuarantinePage() {
  const { org } = Route.useRouteContext();
  const { cases: initialCases } = Route.useLoaderData();
  const setQuarantine = useServerFn(setQuarantineFn);

  const [cases, setCases] = useState<PublicQuarantinedCase[]>(initialCases);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRelease(testCaseId: string) {
    setPendingId(testCaseId);
    try {
      await setQuarantine({ data: { testCaseId, quarantined: false } });
      setCases((prev) => prev.filter((c) => c.testCaseId !== testCaseId));
    } finally {
      setPendingId(null);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before viewing quarantine.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldOff className="h-6 w-6" /> Quarantine
        </h1>
        <p className="text-sm text-muted-foreground">
          Flaky tests pulled out of release-gate consideration. They still run and still report —
          they just can't block a merge on their own. Quarantine a test from the Analytics flaky
          leaderboard.
        </p>
      </div>

      {cases.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing quarantined right now — that's a good sign.
          </p>
          <Button variant="outline" asChild>
            <Link to="/analytics">View flaky-test leaderboard</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Card key={c.testCaseId}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{c.scenarioTitle}</CardTitle>
                    <CardDescription>{c.projectName}</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRelease(c.testCaseId)}
                    disabled={pendingId === c.testCaseId}
                  >
                    {pendingId === c.testCaseId ? "Releasing…" : "Release from quarantine"}
                  </Button>
                </div>
              </CardHeader>
              {c.quarantinedAt && (
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Quarantined{" "}
                  {new Date(c.quarantinedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
