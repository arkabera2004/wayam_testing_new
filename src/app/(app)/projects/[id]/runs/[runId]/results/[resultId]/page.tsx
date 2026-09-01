"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BugPlay,
  Film,
  ImageIcon,
  Network,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";

import { Button, Card, Chip, CodeBlock, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { failure } from "@/lib/demo-data";

const EVIDENCE_TABS = [
  { key: "screenshot", label: "Screenshot", icon: ImageIcon },
  { key: "video", label: "Video replay", icon: Film },
  { key: "trace", label: "Trace", icon: Network },
  { key: "logs", label: "Logs", icon: Terminal },
] as const;

export default function TriagePage({
  params,
}: {
  params: Promise<{ id: string; runId: string; resultId: string }>;
}) {
  const { id, runId } = use(params);
  const [tab, setTab] = useState<(typeof EVIDENCE_TABS)[number]["key"]>("screenshot");
  const [slider, setSlider] = useState(50);
  const [healed, setHealed] = useState(false);
  const { toast } = useToast();

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="border-muted flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-heading-md text-primary truncate">{failure.test}</h1>
          <p className="text-body-sm text-tertiary mt-1">
            Failed at step {failure.step} of {failure.totalSteps} &middot; {failure.browser}{" "}
            &middot;{" "}
            <Link href={`/projects/${id}/runs/${runId}`} className="hover:text-primary underline underline-offset-4">
              run #{failure.run}
            </Link>
          </p>
        </div>
        <Chip tone="error" className="ml-auto">
          <AlertTriangle size={12} aria-hidden="true" />
          Failed
        </Chip>
      </header>

      {/* ---- 3-column triage layout ---- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[260px_1fr_320px] xl:overflow-hidden">
        {/* 1. Step timeline */}
        <div className="border-muted overflow-y-auto border-b p-4 xl:border-r xl:border-b-0">
          <h2 className="text-label-sm text-tertiary mb-3">Steps</h2>
          <ol className="flex flex-col gap-1">
            {failure.steps.map((step) => (
              <li
                key={step.n}
                className={cn(
                  "rounded-lg px-2.5 py-2",
                  step.status === "failed" && "bg-error-surface",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "text-caption tabular mt-0.5 shrink-0",
                      step.status === "failed" ? "text-error" : "text-quaternary",
                    )}
                  >
                    {step.n}
                  </span>
                  <span
                    className={cn(
                      "text-body-md min-w-0",
                      step.status === "failed"
                        ? "text-primary"
                        : step.status === "queued"
                          ? "text-quaternary"
                          : "text-secondary",
                    )}
                  >
                    {step.text}
                  </span>
                </div>

                {step.status === "failed" && (
                  <div className="border-error-stroke/40 bg-container mt-2 rounded-lg border p-2">
                    <p className="text-caption text-quaternary">Selector that failed</p>
                    <code className="text-body-sm text-error mt-1 block break-all">
                      {failure.selector}
                    </code>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* 2. Evidence */}
        <div className="border-muted flex min-h-0 flex-col border-b xl:border-r xl:border-b-0">
          <div className="border-muted flex gap-1 border-b px-4">
            {EVIDENCE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "true" : undefined}
                className={cn(
                  "text-label-md -mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 transition-colors duration-[170ms]",
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

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "screenshot" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm text-tertiary">Expected</span>
                  <span className="text-label-sm text-tertiary">Actual</span>
                </div>

                {/* Slider diff */}
                <div className="border-muted bg-raised relative aspect-video overflow-hidden rounded-lg border">
                  {/* Expected side */}
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="w-2/3">
                      <div className="bg-raised-2 h-2 w-1/3 rounded-full" />
                      <div className="bg-raised-2 mt-2 h-1.5 w-full rounded-full opacity-50" />
                      <div className="bg-raised-2 mt-1.5 h-1.5 w-3/4 rounded-full opacity-40" />
                      <div className="bg-action-primary text-on-color text-caption mt-4 grid h-7 w-28 place-items-center rounded">
                        Pay now
                      </div>
                    </div>
                  </div>

                  {/* Actual side, revealed by the slider */}
                  <div
                    className="bg-container absolute inset-y-0 right-0 grid place-items-center overflow-hidden"
                    style={{ width: `${100 - slider}%` }}
                  >
                    <div className="w-2/3 min-w-40">
                      <div className="bg-raised-2 h-2 w-1/3 rounded-full" />
                      <div className="bg-raised-2 mt-2 h-1.5 w-full rounded-full opacity-50" />
                      <div className="bg-raised-2 mt-1.5 h-1.5 w-3/4 rounded-full opacity-40" />
                      <div className="bg-action-primary text-on-color text-caption ring-error-icon mt-4 grid h-7 w-28 place-items-center rounded ring-2">
                        Place order
                      </div>
                    </div>
                  </div>

                  <div
                    className="bg-error-icon absolute inset-y-0 w-0.5"
                    style={{ left: `${slider}%` }}
                    aria-hidden="true"
                  />
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={slider}
                  onChange={(e) => setSlider(Number(e.target.value))}
                  aria-label="Compare expected and actual screenshots"
                  className="accent-primary w-full"
                />
              </div>
            )}

            {tab === "video" && (
              <div className="border-muted bg-raised grid aspect-video place-items-center rounded-lg border">
                <div className="flex flex-col items-center gap-3">
                  <span className="bg-action-primary icon-on-color grid h-10 w-10 place-items-center rounded-full">
                    <Film size={16} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <p className="text-body-md text-tertiary">Replay of the failing run (0:04)</p>
                </div>
              </div>
            )}

            {tab === "trace" && (
              <div className="flex flex-col gap-2">
                {failure.networkLog.map((r) => (
                  <div
                    key={`${r.method} ${r.path}`}
                    className="border-muted bg-container flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <Chip tone={r.method === "GET" ? "info" : "success"}>{r.method}</Chip>
                    <span className="text-body-md text-secondary min-w-0 flex-1 truncate">
                      {r.path}
                    </span>
                    <span className="text-body-sm text-tertiary tabular shrink-0">{r.status}</span>
                    <div className="hidden w-32 shrink-0 sm:block">
                      <div className="bg-raised h-1.5 w-full rounded-full">
                        <div
                          className="bg-info-icon h-full rounded-full"
                          style={{ width: `${Math.min(100, r.ms / 2)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-caption text-quaternary tabular w-12 shrink-0 text-right">
                      {r.ms}ms
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "logs" && (
              <CodeBlock
                code={failure.consoleLog.join("\n")}
                language="yaml"
                showLineNumbers={false}
              />
            )}
          </div>
        </div>

        {/* 3. AI root cause */}
        <div className="overflow-y-auto p-4">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-warning" aria-hidden="true" />
                Root cause
              </span>
            }
          >
            <p className="text-body-md text-secondary">{failure.rootCause}</p>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-label-sm text-tertiary">Confidence</span>
              <Chip tone="success">{failure.confidence}</Chip>
            </div>

            <div className="border-muted mt-4 rounded-lg border p-3">
              <p className="text-caption text-quaternary">Suggested selector</p>
              <code className="text-body-sm text-error mt-1.5 block break-all line-through">
                {failure.selector}
              </code>
              <code className="text-body-sm text-success mt-1 block break-all">
                {failure.healedSelector}
              </code>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {healed ? (
                <Link href={`/projects/${id}/healing`}>
                  <Button variant="primary" icon={ArrowRight} className="w-full">
                    View in healing center
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="primary"
                  icon={Wrench}
                  className="w-full"
                  onClick={() => {
                    setHealed(true);
                    toast({
                      tone: "success",
                      title: "Locator healed",
                      body: "Updated across 2 tests. A re-run has been queued.",
                      action: { label: "Open healing center", href: `/projects/${id}/healing` },
                    });
                  }}
                >
                  Heal locator
                </Button>
              )}
              <Button
                icon={BugPlay}
                className="w-full"
                onClick={() =>
                  toast({
                    tone: "info",
                    title: "SHOP-1487 created in Jira",
                    body: "Linked to run #137 with the screenshot and trace attached.",
                  })
                }
              >
                File Jira ticket
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  toast({
                    tone: "warning",
                    title: "Marked as a known issue",
                    body: "This failure will not block the quality gate.",
                  })
                }
              >
                Mark as known issue
              </Button>
            </div>

            {healed && (
              <p className="text-body-sm text-success mt-3">
                Locator healed across 2 tests. Re-run queued.
              </p>
            )}
          </Card>

          <Card title="Similar failures" className="mt-4">
            <p className="text-body-md text-tertiary">
              2 other tests failed on the same element in this run.
            </p>
            <Link href={`/projects/${id}/runs/${runId}`} className="mt-3 block">
              <Button className="w-full">View all</Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
