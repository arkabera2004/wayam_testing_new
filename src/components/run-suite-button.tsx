"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/**
 * Triggers a real Playwright run and waits for it.
 *
 * The request stays open for the duration of the suite, which is fine while a
 * run takes seconds. If suites grow past the request budget this is the place
 * that changes - the endpoint would return a queued run id and the page would
 * poll for it.
 */
export function RunSuiteButton({
  projectSlug,
  caseIds,
  label = "Run suite",
  ...rest
}: {
  projectSlug: string;
  /** Omit to run everything; pass ids to run only those cases. */
  caseIds?: string[];
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    toast({
      tone: "info",
      title: caseIds?.length ? `Running ${caseIds.length} test${caseIds.length === 1 ? "" : "s"}` : "Running suite",
      body: "Executing specs in a real browser.",
    });
    try {
      const res = await fetch(`/api/projects/${projectSlug}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(caseIds?.length ? { caseIds } : {}),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ tone: "error", title: "Run could not start", body: data.error });
        return;
      }

      toast({
        tone: data.failed === 0 ? "success" : "warning",
        title: `${data.passed} of ${data.total} passed`,
        body: `Finished in ${(data.durationMs / 1000).toFixed(1)}s.`,
      });
      // The runs table is server-rendered, so ask for fresh data.
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Run failed", body: "The suite could not be executed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant="primary" icon={Play} {...rest} onClick={run} disabled={running}>
      {running ? "Running…" : label}
    </Button>
  );
}
