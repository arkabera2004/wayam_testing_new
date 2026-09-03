"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

import {
  ProjectEntryPicker,
  type EntryPath,
} from "@/components/project-entry-picker";
import { Button } from "@/components/ui";

/**
 * Fullscreen modal-style route. Reuses the dual entry picker so onboarding
 * and new-project cannot drift apart.
 */
export default function NewProjectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [entryPath, setEntryPath] = useState<EntryPath>("requirements");
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const finishLabel =
    entryPath === "requirements" ? "Analyse requirements" : "Start exploration";

  /**
   * Creates the project, then continues into it. This used to be a plain link
   * into the demo project's id, so "New project" created nothing and dropped
   * you into ShopStack whatever you typed.
   */
  async function createAndContinue() {
    if (!name.trim()) {
      toast({ tone: "error", title: "Name required", body: "Give the project a name." });
      return;
    }
    if (entryPath === "application" && !repoUrl.trim()) {
      toast({ tone: "error", title: "Repository URL required", body: "Paste a public GitHub repository URL." });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Could not create project", body: data.error });
        return;
      }
      const projectId = data.project.id;

      // Coming in from a repository, import it before showing anything: the
      // discovery and map screens are rendered from what the import writes.
      if (entryPath === "application" && repoUrl.trim()) {
        toast({ tone: "info", title: "Importing repository", body: "Reading the file tree." });
        const imp = await fetch(`/api/projects/${projectId}/import-repo`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repoUrl: repoUrl.trim() }),
        });
        const result = await imp.json();
        if (!imp.ok) {
          // The project exists; say what failed rather than stranding the user.
          toast({ tone: "error", title: "Import failed", body: result.error });
          router.push(`/projects/${projectId}/settings`);
          return;
        }
        toast({
          tone: "success",
          title: `Imported ${result.repo}`,
          body: `${result.fileCount} files, ${result.pages} routes, ${result.endpoints} endpoints.`,
        });
      }

      const next = entryPath === "requirements" ? "prd/new" : "discovery";
      router.push(`/projects/${projectId}/${next}`);
    } catch {
      toast({ tone: "error", title: "Could not create project", body: "The request failed." });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-primary">New project</h1>
          <p className="text-body-md text-tertiary mt-1.5">
            Start from requirements before code ships, or from a GitHub repo / live URL for an
            existing application.
          </p>
        </div>
        <Link
          href="/projects"
          aria-label="Close"
          className="icon-tertiary hover:icon-secondary hover:bg-raised grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-[170ms]"
        >
          <X size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="project-name" className="text-label-md text-secondary">
          Project name
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ShopStack"
          className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-3 focus-visible:outline-none"
        />
      </div>

      <ProjectEntryPicker
        initialPath={entryPath}
        showAdvanced
        onPathChange={setEntryPath}
      />

      {entryPath === "application" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="repo-url" className="text-label-md text-secondary">
            Public repository URL
          </label>
          <input
            id="repo-url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-3 focus-visible:outline-none"
          />
          <p className="text-body-sm text-quaternary">
            No GitHub connection needed. Parikshan reads the file tree and derives the routes and API
            endpoints it finds. Private repositories cannot be imported this way.
          </p>
        </div>
      )}

      <div className="border-muted flex items-center justify-between border-t pt-5">
        <Link href="/projects">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button
          variant="primary"
          icon={ArrowRight}
          disabled={creating}
          onClick={() => void createAndContinue()}
        >
          {creating ? "Creating…" : finishLabel}
        </Button>
      </div>
    </div>
  );
}
