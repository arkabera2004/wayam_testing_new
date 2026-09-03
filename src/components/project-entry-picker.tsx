"use client";

import { useState } from "react";
import {
  ClipboardPaste,
  FileText,
  FileUp,
  Github,
  Globe,
  Link2,
} from "lucide-react";

import { ProjectSourcePicker } from "@/components/project-source-picker";
import { Button, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { samplePrd } from "@/lib/prd-data";

export type EntryPath = "requirements" | "application";

type SourceTab = "paste" | "upload" | "import";

/**
 * Dual entry for a project: start from requirements (pre-dev) or from an
 * existing application (GitHub / live URL). Used by onboarding and new project.
 */
export function ProjectEntryPicker({
  initialPath = "requirements",
  showAdvanced = false,
  onPathChange,
  repoUrl,
  onRepoUrlChange,
}: {
  initialPath?: EntryPath;
  showAdvanced?: boolean;
  onPathChange?: (path: EntryPath) => void;
  repoUrl?: string;
  onRepoUrlChange?: (url: string) => void;
}) {
  const [path, setPath] = useState<EntryPath>(initialPath);
  const [tab, setTab] = useState<SourceTab>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function selectPath(next: EntryPath) {
    setPath(next);
    onPathChange?.(next);
  }

  const PATHS = [
    {
      key: "requirements" as const,
      icon: FileText,
      title: "Start from requirements",
      body: "Upload an SRS, user stories, or Jira export. Test before code ships.",
      badge: "Path A · Pre-development",
    },
    {
      key: "application" as const,
      icon: Globe,
      title: "Start from your application",
      body: "Paste a public repository or a live URL. Explore what already exists.",
      badge: "Path B · Existing app",
    },
  ];

  const TABS = [
    { key: "paste" as const, icon: ClipboardPaste, label: "Paste text" },
    { key: "upload" as const, icon: FileUp, label: "Upload a file" },
    { key: "import" as const, icon: Link2, label: "Import Jira" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {PATHS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => selectPath(card.key)}
            aria-pressed={path === card.key}
            className={cn(
              "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left",
              "transition-[background-color,border-color] duration-[170ms]",
              path === card.key
                ? "border-active bg-raised"
                : "border-muted bg-container hover:bg-raised",
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full",
                  path === card.key
                    ? "bg-action-primary icon-on-color"
                    : "bg-raised-2 icon-tertiary",
                )}
              >
                <card.icon size={15} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="text-caption text-quaternary">{card.badge}</span>
            </div>
            <span className="text-heading-sm text-primary">{card.title}</span>
            <span className="text-body-md text-tertiary">{card.body}</span>
          </button>
        ))}
      </div>

      {path === "requirements" ? (
        <div className="border-muted bg-container overflow-hidden rounded-xl border">
          <div className="border-muted flex gap-1 border-b px-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "true" : undefined}
                className={cn(
                  "text-label-md -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors duration-[170ms]",
                  tab === t.key
                    ? "border-action-primary text-primary"
                    : "text-tertiary hover:text-secondary border-transparent",
                )}
              >
                <t.icon size={13} aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "paste" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="entry-req-text" className="text-label-md text-secondary">
                    Paste SRS, user stories, or acceptance criteria
                  </label>
                  <Button size="sm" onClick={() => setText(samplePrd)}>
                    Use sample requirements
                  </Button>
                </div>
                <textarea
                  id="entry-req-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  placeholder="Paste Markdown, plain text, or anything a human would read..."
                  className={cn(
                    "border-muted bg-raised text-body-md text-primary placeholder:text-quaternary",
                    "focus-visible:border-active w-full resize-y rounded-lg border p-3.5 font-mono focus-visible:outline-none",
                  )}
                />
                <span className="text-caption text-quaternary tabular">
                  {words.toLocaleString()} words
                </span>
              </div>
            )}

            {tab === "upload" && (
              <label
                htmlFor="entry-req-file"
                className={cn(
                  "border-muted hover:bg-raised flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
                  "transition-colors duration-[170ms]",
                )}
              >
                <span className="bg-raised-2 icon-tertiary grid h-10 w-10 place-items-center rounded-full">
                  <FileUp size={18} aria-hidden="true" />
                </span>
                <span className="text-heading-sm text-primary">
                  {fileName ?? "Drop a PDF, DOCX, or Markdown file"}
                </span>
                <span className="text-body-md text-tertiary">
                  Or click to browse. Max 20 MB.
                </span>
                <input
                  id="entry-req-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.md,.txt"
                  className="sr-only"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
            )}

            {tab === "import" && (
              <div className="flex flex-col gap-4">
                <p className="text-body-md text-tertiary">
                  Pull stories and acceptance criteria from Jira. Connect once; Parikshan keeps
                  requirement ↔ test traceability in sync when tickets change.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="jira-project" className="text-label-md text-secondary">
                      Jira project
                    </label>
                    <select
                      id="jira-project"
                      className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-2.5 focus-visible:outline-none"
                    >
                      <option>SHOP - ShopStack</option>
                      <option>PAY - Payments</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="jira-filter" className="text-label-md text-secondary">
                      Filter
                    </label>
                    <select
                      id="jira-filter"
                      className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-2.5 focus-visible:outline-none"
                    >
                      <option>Current sprint</option>
                      <option>All open stories</option>
                      <option>Label: checkout</option>
                    </select>
                  </div>
                </div>
                <ActionButton icon="link" className="w-full sm:w-auto" title="Jira connector unavailable" body="Issue import is not part of this build.">
                  Connect Jira
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-tertiary flex items-center gap-2">
            <Github size={14} className="shrink-0" aria-hidden="true" />
            Repository for structure, or a live URL for exploration - authenticated flows included.
          </p>
          <ProjectSourcePicker
            showAdvanced={showAdvanced}
            repoUrl={repoUrl}
            onRepoUrlChange={onRepoUrlChange}
          />
        </div>
      )}
    </div>
  );
}
