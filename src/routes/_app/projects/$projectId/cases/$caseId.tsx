import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileCode2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { getOrCreateTestCaseFn } from "@/lib/cases/functions";

// The route param is historically named "caseId" but is really the
// scenario's id — "Generate code" links here directly from the test plan
// view, and the test_case is created (or found) on first visit. See
// getOrCreateTestCaseFn.
export const Route = createFileRoute("/_app/projects/$projectId/cases/$caseId")({
  loader: ({ params }) => getOrCreateTestCaseFn({ data: { scenarioId: params.caseId } }),
  component: TestCaseDetailPage,
});

const LANGUAGE_LABEL: Record<string, string> = {
  E2E: "Playwright · TypeScript",
  Regression: "Playwright · TypeScript",
  Accessibility: "Playwright · TypeScript",
  Visual: "Playwright · TypeScript",
  API: "HTTP assertions · TypeScript",
};

function TestCaseDetailPage() {
  const { scenario, testCase } = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const lines = testCase.generatedCode.split("\n");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/projects/$projectId" params={{ projectId }}>
          <ArrowLeft className="h-4 w-4" /> Back to test plan
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/60 bg-secondary/30 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileCode2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">
                {scenario.filePath ?? `${testCase.framework}/${testCase.id}.spec.ts`}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {LANGUAGE_LABEL[scenario.type]}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="overflow-x-auto bg-[oklch(0.14_0.016_250)] p-4 text-[13px] leading-6">
              <code className="font-mono">
                {lines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="mr-4 w-6 shrink-0 select-none text-right text-muted-foreground/40">
                      {i + 1}
                    </span>
                    <span className="whitespace-pre text-foreground/90">{line || " "}</span>
                  </div>
                ))}
              </code>
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Linked scenario</p>
              <p className="font-medium">{scenario.title}</p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground">File path</p>
              <p className="font-mono text-xs">
                {scenario.filePath ?? `${testCase.framework}/${testCase.id}.spec.ts`}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">{scenario.type}</p>
            </div>
            <Separator />
            <div>
              <p className="mb-1 text-muted-foreground">Status</p>
              <StatusBadge status={testCase.status} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
