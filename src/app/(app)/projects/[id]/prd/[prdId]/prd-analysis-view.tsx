"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  Chip,
  PageHeader,
  ProgressBar,
  StatCard,
  cn,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  type CoverageState,
  type Priority,
  type RequirementKind,
} from "@/lib/prd-data";

export type PrdRequirement = {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: Priority;
  coverage: CoverageState;
  cases: number;
  ambiguity?: string;
};

export type PrdCase = {
  id: string;
  requirement: string;
  title: string;
  expectation: string;
  tags: string[];
  priority: Priority;
  steps: string[];
  approved: boolean;
};

export type PrdStats = {
  requirements: number;
  testable: number;
  cases: number;
  ambiguities: number;
  coverage: number;
};

const TABS = ["Requirements", "Test cases", "Traceability", "Document"] as const;

function kindTone(kind: RequirementKind) {
  if (kind === "security") return "error" as const;
  if (kind === "accessibility") return "info" as const;
  if (kind === "non-functional") return "warning" as const;
  return "neutral" as const;
}

function coverageTone(state: CoverageState) {
  if (state === "covered") return "success" as const;
  if (state === "partial") return "warning" as const;
  return "error" as const;
}

function priorityTone(p: Priority) {
  if (p === "P0") return "error" as const;
  if (p === "P1") return "warning" as const;
  return "neutral" as const;
}

function tagTone(tag: string) {
  if (tag === "negative" || tag === "security") return "error" as const;
  if (tag === "edge-case" || tag === "performance") return "warning" as const;
  if (tag === "happy-path") return "success" as const;
  if (tag === "accessibility") return "info" as const;
  return "neutral" as const;
}

export function PrdAnalysisView({
  id,
  requirements,
  initialCases,
  prdStats,
  prdText,
}: {
  id: string;
  requirements: PrdRequirement[];
  initialCases: PrdCase[];
  prdStats: PrdStats;
  prdText: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<(typeof TABS)[number]>("Requirements");
  const [cases, setCases] = useState<PrdCase[]>(initialCases);
  const [openReq, setOpenReq] = useState<string | null>(requirements[0]?.id ?? null);
  const [openSteps, setOpenSteps] = useState<string[]>([]);

  const approved = cases.filter((c) => c.approved).length;
  const pct = cases.length ? Math.round((approved / cases.length) * 100) : 0;

  const ambiguous = useMemo(() => requirements.filter((r) => r.ambiguity), [requirements]);

  const toggleApprove = (caseId: string) => {
    const next = !cases.find((c) => c.id === caseId)?.approved;
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, approved: next } : c)));
    void fetch(`/api/test-cases/${caseId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved: next }),
    }).then((res) => {
      // Put it back if the write was refused, so the tick never lies.
      if (!res.ok) setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, approved: !next } : c)));
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="pb-24">
          <PageBody>
            <PageHeader
              title="Express Checkout"
              description="Analysed 2 minutes ago from a pasted document. Every proposed case traces back to a numbered requirement."
              actions={
                <Button
                  icon={Sparkles}
                  onClick={() => router.push(`/projects/${id}/prd/new`)}
                >
                  Re-analyse
                </Button>
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Requirements" value={String(prdStats.requirements)} display />
              <StatCard label="Testable" value={String(prdStats.testable)} display />
              <StatCard label="Cases proposed" value={String(prdStats.cases)} display />
              <StatCard
                label="Ambiguities"
                value={String(prdStats.ambiguities)}
                delta="review"
                deltaTone="error"
              />
              <StatCard
                label="Requirement coverage"
                value={`${prdStats.coverage}%`}
                delta="1 gap"
                deltaTone="error"
              />
            </div>

            {/* Ambiguity findings - the credibility moment */}
            <Card
              title={
                <span className="flex items-center gap-2">
                  <TriangleAlert size={14} className="text-warning" aria-hidden="true" />
                  What Parikshan could not test as written
                </span>
              }
              subtitle="Reviewed before generating anything, so the gaps are yours to close"
            >
              <div className="flex flex-col gap-3">
                {ambiguous.map((req) => (
                  <div
                    key={req.id}
                    className="border-warning-stroke/40 bg-warning-surface rounded-lg border p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-label-md text-primary tabular">{req.id}</span>
                      <Chip tone={coverageTone(req.coverage)}>{req.coverage}</Chip>
                      <Chip tone={kindTone(req.kind)}>{req.kind}</Chip>
                    </div>
                    <p className="text-body-md text-secondary mt-2">{req.ambiguity}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Tabs */}
            <div className="border-muted flex gap-1 overflow-x-auto border-b">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-current={tab === t ? "true" : undefined}
                  className={cn(
                    "text-label-md -mb-px border-b-2 px-3 py-2.5 whitespace-nowrap transition-colors duration-[170ms]",
                    tab === t
                      ? "border-action-primary text-primary"
                      : "text-tertiary hover:text-secondary border-transparent",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* ---- Requirements ---- */}
            {tab === "Requirements" && (
              <div className="flex flex-col gap-2.5">
                {requirements.map((req) => {
                  const open = openReq === req.id;
                  const reqCases = cases.filter((c) => c.requirement === req.id);

                  return (
                    <Card key={req.id} padded={false}>
                      <button
                        type="button"
                        onClick={() => setOpenReq(open ? null : req.id)}
                        aria-expanded={open}
                        className="flex w-full items-start gap-3 p-4 text-left"
                      >
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className={cn(
                            "icon-tertiary mt-1 shrink-0 transition-transform duration-[170ms]",
                            !open && "-rotate-90",
                          )}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-label-md text-primary tabular">{req.id}</span>
                            <Chip tone={priorityTone(req.priority)}>{req.priority}</Chip>
                            <Chip tone={kindTone(req.kind)}>{req.kind}</Chip>
                            <Chip tone={coverageTone(req.coverage)}>
                              {req.coverage === "gap" ? "not testable" : req.coverage}
                            </Chip>
                            {req.ambiguity ? (
                              <TriangleAlert
                                size={13}
                                className="text-warning shrink-0"
                                aria-label="Has an ambiguity finding"
                              />
                            ) : null}
                          </div>
                          <p className="text-body-md text-secondary mt-2">{req.text}</p>
                        </div>

                        <span className="text-caption text-quaternary tabular shrink-0">
                          {req.cases} {req.cases === 1 ? "case" : "cases"}
                        </span>
                      </button>

                      {open && (
                        <div className="border-muted border-t p-4">
                          {req.ambiguity ? (
                            <div className="border-warning-stroke/40 bg-warning-surface mb-3 rounded-lg border p-3">
                              <p className="text-label-sm text-warning">Ambiguity</p>
                              <p className="text-body-md text-secondary mt-1">{req.ambiguity}</p>
                            </div>
                          ) : null}

                          {reqCases.length === 0 ? (
                            <p className="text-body-md text-tertiary">
                              No cases proposed. Rewrite this requirement with a measurable
                              threshold and re-analyse.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-2">
                              {reqCases.map((c) => (
                                <li
                                  key={c.id}
                                  className="border-muted flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
                                >
                                  <span className="text-caption text-quaternary tabular mt-0.5 shrink-0">
                                    {c.id}
                                  </span>
                                  <span className="text-body-md text-primary min-w-0 flex-1">
                                    {c.title}
                                  </span>
                                  {c.approved ? (
                                    <Check
                                      size={13}
                                      className="text-success mt-0.5 shrink-0"
                                      aria-label="Approved"
                                    />
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ---- Test cases ---- */}
            {tab === "Test cases" && (
              <div className="flex flex-col gap-2.5">
                {cases.map((c) => {
                  const stepsOpen = openSteps.includes(c.id);
                  return (
                    <article
                      key={c.id}
                      className={cn(
                        "bg-container rounded-xl border transition-[border-color] duration-[170ms]",
                        c.approved
                          ? "border-success-stroke/50 border-l-success-icon border-l-2"
                          : "border-muted",
                      )}
                    >
                      <div className="flex items-start gap-3 p-4">
                        <button
                          type="button"
                          onClick={() => toggleApprove(c.id)}
                          aria-pressed={c.approved}
                          aria-label={c.approved ? `Unapprove ${c.title}` : `Approve ${c.title}`}
                          className={cn(
                            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-[170ms]",
                            c.approved
                              ? "bg-success-icon text-on-color border-transparent"
                              : "border-default icon-quaternary hover:border-active",
                          )}
                        >
                          {c.approved ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-caption text-quaternary tabular">{c.id}</span>
                            <Chip tone="neutral">{c.requirement}</Chip>
                            <Chip tone={priorityTone(c.priority)}>{c.priority}</Chip>
                          </div>

                          <p className="text-heading-sm text-primary mt-2">{c.title}</p>
                          <p className="text-body-md text-tertiary mt-1.5">
                            <span className="text-quaternary">Expect:</span> {c.expectation}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {c.tags.map((t) => (
                              <Chip key={t} tone={tagTone(t)}>
                                {t}
                              </Chip>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenSteps((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((x) => x !== c.id)
                                  : [...prev, c.id],
                              )
                            }
                            aria-expanded={stepsOpen}
                            className="text-label-sm text-tertiary hover:text-primary mt-3 flex items-center gap-1.5 transition-colors duration-[170ms]"
                          >
                            <ChevronDown
                              size={13}
                              aria-hidden="true"
                              className={cn(
                                "transition-transform duration-[170ms]",
                                stepsOpen && "rotate-180",
                              )}
                            />
                            {c.steps.length} steps
                          </button>

                          {stepsOpen && (
                            <ol className="border-muted mt-2.5 flex flex-col gap-1.5 border-l pl-4">
                              {c.steps.map((s, i) => (
                                <li key={i} className="text-body-md text-secondary flex gap-2">
                                  <span className="text-quaternary tabular shrink-0">{i + 1}.</span>
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* ---- Traceability matrix ---- */}
            {tab === "Traceability" && (
              <Card
                title="Requirement to test coverage"
                subtitle="Every requirement, and what covers it"
                padded={false}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="text-label-sm text-tertiary border-muted border-b px-4 py-2.5 font-medium">
                          Requirement
                        </th>
                        <th className="text-label-sm text-tertiary border-muted border-b px-4 py-2.5 font-medium">
                          Type
                        </th>
                        <th className="text-label-sm text-tertiary border-muted border-b px-4 py-2.5 font-medium">
                          Covering cases
                        </th>
                        <th className="text-label-sm text-tertiary border-muted border-b px-4 py-2.5 font-medium">
                          Coverage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.map((req) => {
                        const reqCases = cases.filter((c) => c.requirement === req.id);
                        return (
                          <tr key={req.id} className="hover:bg-raised transition-colors duration-[170ms]">
                            <td className="border-muted border-b px-4 py-3 align-top">
                              <span className="text-label-md text-primary tabular block">
                                {req.id}
                              </span>
                              <span className="text-body-sm text-tertiary mt-1 block max-w-md">
                                {req.text}
                              </span>
                            </td>
                            <td className="border-muted border-b px-4 py-3 align-top">
                              <Chip tone={kindTone(req.kind)}>{req.kind}</Chip>
                            </td>
                            <td className="border-muted border-b px-4 py-3 align-top">
                              {reqCases.length === 0 ? (
                                <span className="text-body-sm text-error">Nothing covers this</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {reqCases.map((c) => (
                                    <Chip key={c.id}>{c.id}</Chip>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="border-muted border-b px-4 py-3 align-top">
                              <Chip tone={coverageTone(req.coverage)}>
                                {req.coverage === "gap" ? "not testable" : req.coverage}
                              </Chip>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ---- Source document ---- */}
            {tab === "Document" && (
              <Card
                title={
                  <span className="flex items-center gap-2">
                    <FileText size={14} className="icon-tertiary" aria-hidden="true" />
                    Source document
                  </span>
                }
                subtitle="1,842 words, pasted"
              >
                <pre className="text-body-sm text-secondary font-mono whitespace-pre-wrap">
                  {prdText}
                </pre>
              </Card>
            )}
          </PageBody>
        </div>
      </div>

      {/* Sticky approval footer */}
      <div className="border-muted bg-container/95 sticky bottom-0 border-t px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-label-md text-primary tabular">
                {approved} of {cases.length} cases approved
              </span>
              <span className="text-label-sm text-tertiary tabular">{pct}%</span>
            </div>
            <ProgressBar value={pct} className="mt-1.5" />
          </div>

          <Button onClick={() => setCases((prev) => prev.map((c) => ({ ...c, approved: true })))}>
            Approve all
          </Button>

          <Button
            variant="primary"
            icon={ArrowRight}
            disabled={approved === 0}
            onClick={() => {
              toast({
                tone: "success",
                title: `${approved} cases added to the test plan`,
                body: "They now sit alongside the scenarios discovered by crawling.",
                action: { label: "Open the test plan", href: `/projects/${id}/plan` },
              });
              router.push(`/projects/${id}/plan`);
            }}
          >
            Add approved cases to test plan
          </Button>
        </div>
      </div>
    </div>
  );
}
