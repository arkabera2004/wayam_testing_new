"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardPaste,
  FileUp,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, Chip, PageHeader, ProgressBar, cn } from "@/components/ui";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";
import { useToast } from "@/components/ui/toast";
import { analysisStages, samplePrd } from "@/lib/prd-data";

type SourceTab = "paste" | "upload" | "import";

const STAGE_MS = 620;

/** One mark per analysis stage, in the order analysisStages declares them. */
const STAGE_ART: Icon3DName[] = [
  "prd-extract",
  "prd-extract",
  "prd-classify",
  "prd-ambiguity",
  "prd-traceability",
  "prd-generate",
];

export default function NewPrdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<SourceTab>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [stage, setStage] = useState(0);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyse = tab === "paste" ? words > 20 : tab === "upload" ? Boolean(fileName) : true;

  // Walk the analysis stages, then hand off to the results page.
  useEffect(() => {
    if (!analysing) return;

    if (stage >= analysisStages.length) {
      const t = setTimeout(() => {
        toast({
          tone: "success",
          title: "Analysis complete",
          body: "10 requirements extracted, 13 test cases proposed.",
        });
        router.push(`/projects/${id}/prd/express-checkout`);
      }, 500);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setStage((s) => s + 1), STAGE_MS);
    return () => clearTimeout(t);
  }, [analysing, stage, id, router, toast]);

  const TABS = [
    { key: "paste" as const, icon: ClipboardPaste, label: "Paste text" },
    { key: "upload" as const, icon: FileUp, label: "Upload a file" },
    { key: "import" as const, icon: Link2, label: "Import" },
  ];

  if (analysing) {
    const pct = Math.round((Math.min(stage, analysisStages.length) / analysisStages.length) * 100);

    return (
      <PageBody>
        <PageHeader title="Analysing requirements" description="This usually takes under a minute." />

        <Card>
          <div className="flex items-center gap-3.5">
            <Icon3D
              name={STAGE_ART[Math.min(stage, STAGE_ART.length - 1)]}
              size={64}
              className="transition-opacity duration-300"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-label-md text-primary">Express Checkout</span>
                <span className="text-label-sm text-tertiary tabular">{pct}%</span>
              </div>
              <ProgressBar value={pct} className="mt-2" />
            </div>
          </div>

          <ol className="mt-5 flex flex-col gap-1">
            {analysisStages.map((s, i) => {
              const state = i < stage ? "done" : i === stage ? "active" : "pending";
              return (
                <li
                  key={s.label}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-[170ms]",
                    state === "active" && "bg-raised",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {state === "done" ? (
                      <span className="bg-success-surface text-success grid h-5 w-5 place-items-center rounded-full">
                        <Check size={11} strokeWidth={3} aria-hidden="true" />
                      </span>
                    ) : state === "active" ? (
                      <span className="bg-info-surface text-info grid h-5 w-5 place-items-center rounded-full">
                        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="bg-raised grid h-5 w-5 place-items-center rounded-full">
                        <span className="bg-raised-2 h-1.5 w-1.5 rounded-full" />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0">
                    <span
                      className={cn(
                        "text-label-md block",
                        state === "pending" ? "text-quaternary" : "text-primary",
                      )}
                    >
                      {s.label}
                    </span>
                    {state !== "pending" && (
                      <span className="text-body-sm text-tertiary block">{s.detail}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Analyse requirements"
        description="Parikshan reads the document, extracts atomic requirements, runs requirement intelligence, and proposes test scenarios traced back to each requirement."
      />

      <Card padded={false}>
        {/* Source tabs */}
        <div className="border-muted flex gap-1 border-b px-4">
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
                <label htmlFor="prd-text" className="text-label-md text-secondary">
                  Paste your SRS, user stories, or acceptance criteria
                </label>
                <Button size="sm" onClick={() => setText(samplePrd)}>
                  Use sample requirements
                </Button>
              </div>

              <textarea
                id="prd-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={18}
                placeholder="Paste Markdown, plain text, or anything a human would read..."
                className={cn(
                  "border-muted bg-raised text-body-md text-primary placeholder:text-quaternary",
                  "focus-visible:border-active w-full resize-y rounded-lg border p-3.5 font-mono focus-visible:outline-none",
                )}
              />

              <div className="flex items-center gap-3">
                <span className="text-caption text-quaternary tabular">
                  {words.toLocaleString()} words
                </span>
                {words > 0 && words <= 20 ? (
                  <span className="text-caption text-warning">
                    Add at least 20 words so there is something to analyse.
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="flex flex-col gap-3">
              <label
                htmlFor="prd-file"
                className={cn(
                  "border-muted hover:bg-raised flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center",
                  "transition-colors duration-[170ms]",
                )}
              >
                <span className="bg-raised icon-tertiary grid h-10 w-10 place-items-center rounded-full">
                  <FileUp size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="text-heading-sm text-primary block">
                    {fileName ?? "Drop a file, or click to choose"}
                  </span>
                  <span className="text-body-md text-tertiary mt-1 block">
                    PDF, Word, Markdown or plain text, up to 10 MB
                  </span>
                </span>
              </label>
              <input
                id="prd-file"
                type="file"
                className="sr-only"
                accept=".pdf,.doc,.docx,.md,.txt"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              {fileName ? (
                <div className="flex items-center gap-2">
                  <Chip tone="success">
                    <Check size={11} aria-hidden="true" />
                    Ready
                  </Chip>
                  <span className="text-body-md text-secondary truncate">{fileName}</span>
                </div>
              ) : null}
            </div>
          )}

          {tab === "import" && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: "Confluence", detail: "Import a page by URL" },
                { name: "Notion", detail: "Import a database page" },
                { name: "Jira", detail: "Import an epic and its description" },
              ].map((src) => (
                <div key={src.name} className="border-muted bg-raised rounded-xl border p-4">
                  <span className="bg-raised-2 text-label-md text-secondary grid h-8 w-8 place-items-center rounded-lg">
                    {src.name.charAt(0)}
                  </span>
                  <p className="text-heading-sm text-primary mt-3">{src.name}</p>
                  <p className="text-body-md text-tertiary mt-1">{src.detail}</p>
                  <Button className="mt-3 w-full" size="sm">
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Analysis options */}
      <Card title="What to generate">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Happy paths", on: true },
            { label: "Edge cases", on: true },
            { label: "Negative scenarios", on: true },
            { label: "Accessibility checks", on: true },
            { label: "Performance budgets", on: false },
            { label: "Security assertions", on: true },
          ].map((opt) => (
            <label key={opt.label} className="flex items-center justify-between gap-4">
              <span className="text-body-md text-secondary">{opt.label}</span>
              <input type="checkbox" defaultChecked={opt.on} className="accent-primary" />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/projects/${id}/prd`)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={Sparkles}
          disabled={!canAnalyse}
          onClick={() => {
            setStage(0);
            setAnalysing(true);
          }}
        >
          Analyse document
        </Button>
      </div>
    </PageBody>
  );
}
