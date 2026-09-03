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

export function ImportPanel({ projectId, info }: { projectId: string; info: ImportInfo }) {
  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState(info?.repoUrl ?? "");
  const [busy, setBusy] = useState(false);

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
            the running app. Generating executable specs from arbitrary source is not wired yet.
          </p>
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
