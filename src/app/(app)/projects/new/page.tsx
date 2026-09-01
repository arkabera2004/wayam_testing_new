"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

import {
  ProjectEntryPicker,
  type EntryPath,
} from "@/components/project-entry-picker";
import { Button } from "@/components/ui";
import { project } from "@/lib/demo-data";

/**
 * Fullscreen modal-style route. Reuses the dual entry picker so onboarding
 * and new-project cannot drift apart.
 */
export default function NewProjectPage() {
  const [entryPath, setEntryPath] = useState<EntryPath>("requirements");
  const finishHref =
    entryPath === "requirements"
      ? `/projects/${project.id}/prd/new`
      : `/projects/${project.id}/discovery`;
  const finishLabel =
    entryPath === "requirements" ? "Analyse requirements" : "Start exploration";

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

      <ProjectEntryPicker
        initialPath={entryPath}
        showAdvanced
        onPathChange={setEntryPath}
      />

      <div className="border-muted flex items-center justify-between border-t pt-5">
        <Link href="/projects">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Link href={finishHref}>
          <Button variant="primary" icon={ArrowRight}>
            {finishLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}
