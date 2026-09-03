"use client";

import { useState } from "react";
import { Github, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, Card, Chip } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

export type ImportInfo = {
  repoUrl: string;
  ref: string | null;
  framework: string | null;
  fileCount: number;
  storedCount: number;
  truncated: boolean;
  importedLabel: string;
  totalBytes: number;
  byExtension: Array<{ ext: string; files: number; bytes: number }>;
  pages: number;
  endpoints: number;
} | null;

export function ImportPanel({
  projectId,
  info,
  initialBaseUrl,
}: {
  projectId: string;
  info: ImportInfo;
  initialBaseUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState(info?.repoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);

  /**
   * Writes a spec per discovered route. The specs need somewhere to navigate,
   * so the base URL is saved with the project first - without it there is
   * nothing for a generated test to open.
   */
  async function generate() {
    if (!baseUrl.trim()) {
      toast({ tone: "error", title: "Base URL required", body: "Where does this application run?" });
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim() }),
      });
      const res = await fetch(`/api/projects/${projectId}/generate-tests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Could not generate", body: data.error });
        return;
      }
      toast({
        tone: "success",
        title: `${data.generated} specs generated`,
        body: "One per discovered route. Review them on Tests before running.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/review-repo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Could not review", body: data.error });
        return;
      }
      toast({
        tone: data.findings ? "warning" : "success",
        title: `${data.findings} findings across ${data.filesReviewed} files`,
        body: "Open Code Reviewer to read them.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!url.trim()) {
      toast({ tone: "error", title: "URL required", body: "Paste a public GitHub repository URL." });
      return;
    }
    setBusy(true);
    toast({ tone: "info", title: "Importing", body: "Reading the repository's file tree." });
    try {
      const res = await fetch(`/api/projects/${projectId}/import-repo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Import failed", body: data.error });
        return;
      }
      toast({
        tone: "success",
        title: `Imported ${data.repo}`,
        body: `${data.fileCount} files, ${data.pages} routes, ${data.endpoints} endpoints.`,
      });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Import failed", body: "The request could not be completed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Repository import"
      subtitle={
        info
          ? `${info.repoUrl.replace("https://github.com/", "")} at ${info.ref} - ${info.importedLabel}`
          : "Paste a public repository and Parikshan reads it. No GitHub connection needed."
      }
      actions={
        <span className="flex items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            aria-label="Public repository URL"
            className="border-muted bg-raised text-body-md text-primary h-8 w-64 rounded-lg border px-2.5 focus-visible:outline-none"
          />
          <Button size="sm" variant="primary" icon={info ? RefreshCw : Github} disabled={busy} onClick={() => void run()}>
            {busy ? "Importing…" : info ? "Re-import" : "Import"}
          </Button>
        </span>
      }
    >
      {info ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-8">
            <Stat label="Files" value={info.fileCount.toLocaleString()} />
            <Stat label="Contents stored" value={info.storedCount.toLocaleString()} />
            <Stat label="Routes found" value={info.pages.toLocaleString()} />
            <Stat label="API endpoints" value={info.endpoints.toLocaleString()} />
            <Stat label="Size" value={`${Math.round(info.totalBytes / 1024).toLocaleString()} KB`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {info.framework && <Chip tone="success">{info.framework}</Chip>}
            {info.truncated && <Chip tone="warning">Truncated - very large repository</Chip>}
            {info.byExtension.map((e) => (
              <Chip key={e.ext}>
                {e.ext} · {e.files}
              </Chip>
            ))}
          </div>

          <p className="text-body-sm text-quaternary">
            Routes and endpoints are derived from the file tree by static analysis, not by crawling
            the running app.
          </p>

          <div className="border-muted flex flex-col gap-2 rounded-lg border p-3">
            <label htmlFor="base-url" className="text-label-md text-secondary">
              Application base URL
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:5000"
                className="border-muted bg-raised text-body-md text-primary h-9 min-w-64 flex-1 rounded-lg border px-3 focus-visible:outline-none"
              />
              <Button variant="primary" disabled={busy} onClick={() => void generate()}>
                Generate tests from routes
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void review()}>
                Review the source
              </Button>
            </div>
            <p className="text-body-sm text-quaternary">
              One spec per route, checking the page responds and renders. They are starting points to
              edit, not finished tests - nothing here has read what the app is supposed to do.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-body-md text-tertiary">
          Nothing imported yet. Parikshan reads the file tree anonymously, so only public
          repositories can be imported this way.
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-display-sm text-primary tabular">{value}</p>
      <p className="text-label-md text-secondary mt-1">{label}</p>
    </div>
  );
}
