import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen } from "lucide-react";

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
import { generateDocTestsFn, type PublicDocTestRun } from "@/lib/doc-tests/functions";

export const Route = createFileRoute("/_app/doc-tests")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects };
  },
  component: DocTestsPage,
});

function DocTestsPage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const generate = useServerFn(generateDocTestsFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicDocTestRun | null>(null);

  async function handleGenerate() {
    if (!projectId || docText.trim().length < 20) return;
    setPending(true);
    setError(null);
    try {
      setResult(await generate({ data: { projectId, docTitle, docText } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate scenarios");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using doc tests.
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
          <BookOpen className="h-6 w-6" /> Doc Tests
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste documentation (a README section, API reference, spec) and Parikshan drafts test
          scenarios for its stated requirements.
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
              <CardTitle className="text-base">Documentation</CardTitle>
              <CardDescription>
                If Gemini is unavailable, a heuristic sentence-extraction pass runs instead — the
                feature still works either way.
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
                  placeholder="Document title (optional)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Textarea
                placeholder="Paste documentation text here…"
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                rows={8}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleGenerate}
                disabled={!projectId || docText.trim().length < 20 || pending}
              >
                {pending ? "Generating…" : "Generate scenarios"}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{result.docTitle}</CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {result.source === "gemini" ? "AI-drafted" : "heuristic fallback"}
                  </Badge>
                </div>
                <CardDescription>{result.scenarios.length} scenario(s) drafted</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.scenarios.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{s.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.type}</Badge>
                        <PriorityBadge priority={s.priority} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
