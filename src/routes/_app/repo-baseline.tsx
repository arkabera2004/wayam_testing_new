import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ScanSearch, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProjectsFn } from "@/lib/projects/functions";
import { getRepoBaselineFn } from "@/lib/repo-baseline/functions";
import type { RepoBaselineReport } from "@/lib/repo-baseline/analyze";

export const Route = createFileRoute("/_app/repo-baseline")({
  loader: async ({ context }) => {
    if (!context.org) return { projects: [] };
    const projects = await listProjectsFn({ data: { orgId: context.org.id } });
    return { projects: projects.filter((p) => p.sourceType === "github") };
  },
  component: RepoBaselinePage,
});

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      {label}
    </div>
  );
}

function RepoBaselinePage() {
  const { org } = Route.useRouteContext();
  const { projects } = Route.useLoaderData();
  const scan = useServerFn(getRepoBaselineFn);

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RepoBaselineReport | null>(null);

  async function handleScan() {
    if (!projectId) return;
    setPending(true);
    setError(null);
    try {
      setReport(await scan({ data: { projectId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan this repository");
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace before using repo baseline.
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
          <ScanSearch className="h-6 w-6" /> Repo Baseline
        </h1>
        <p className="text-sm text-muted-foreground">
          A structural snapshot of a repo before drafting its test plan: languages, test presence,
          CI config, README.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Add a GitHub-sourced project first — repo baseline scans its file tree.
          </p>
          <Button asChild>
            <Link to="/projects/new">Add a project</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scan</CardTitle>
              <CardDescription>
                Reads the repo's file tree and README via the GitHub API.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
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
              <Button onClick={handleScan} disabled={!projectId || pending}>
                {pending ? "Scanning…" : "Scan repository"}
              </Button>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {report && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatTile label="Files scanned" value={report.totalFiles} />
                <StatTile label="Test files" value={report.testFileCount} />
                <StatTile label="README length" value={`${report.readmeLength} chars`} />
              </div>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <BoolRow label="Has a GitHub Actions CI config" value={report.hasCiConfig} />
                  <BoolRow label="Has a README" value={report.hasReadme} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Language breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.languages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recognized source files found.
                    </p>
                  ) : (
                    report.languages.map((lang) => (
                      <div
                        key={lang.extension}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-mono">.{lang.extension}</span>
                        <span className="text-muted-foreground">
                          {lang.fileCount} file(s) · {lang.pct}%
                        </span>
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
