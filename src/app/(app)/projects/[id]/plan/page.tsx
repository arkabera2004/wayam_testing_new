"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button, Card, Chip, ProgressBar, cn } from "@/components/ui";
import { journeys, planStats, testPlan, type TestCase } from "@/lib/demo-data";

function TagTone(tag: string) {
  if (tag === "negative") return "error" as const;
  if (tag === "edge-case") return "warning" as const;
  if (tag === "happy-path") return "success" as const;
  return "neutral" as const;
}

function TestCaseCard({
  testCase,
  onToggleApprove,
}: {
  testCase: TestCase;
  onToggleApprove: () => void;
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(testCase.title);

  return (
    <article
      className={cn(
        "bg-container rounded-xl border transition-[border-color] duration-[170ms]",
        testCase.approved ? "border-success-stroke/50 border-l-success-icon border-l-2" : "border-muted",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggleApprove}
          aria-label={testCase.approved ? `Unapprove ${title}` : `Approve ${title}`}
          aria-pressed={testCase.approved}
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-[170ms]",
            testCase.approved
              ? "bg-success-icon border-transparent text-on-color"
              : "border-default icon-quaternary hover:border-active",
          )}
        >
          {testCase.approved ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                aria-label="Test case title"
                className="border-muted bg-raised text-body-md text-primary focus-visible:border-active w-full resize-none rounded-lg border px-2.5 py-2 focus-visible:outline-none"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => setEditing(false)}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTitle(testCase.title);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-heading-sm text-primary flex items-start gap-2">
                {testCase.star ? (
                  <Sparkles size={14} className="text-warning mt-1 shrink-0" aria-hidden="true" />
                ) : null}
                <span>{title}</span>
              </p>
              <p className="text-body-md text-tertiary mt-1.5">
                <span className="text-quaternary">Expect:</span> {testCase.expectation}
              </p>
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {testCase.tags.map((tag) => (
              <Chip key={tag} tone={TagTone(tag)}>
                {tag}
              </Chip>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStepsOpen((o) => !o)}
            aria-expanded={stepsOpen}
            className="text-label-sm text-tertiary hover:text-primary mt-3 flex items-center gap-1.5 transition-colors duration-[170ms]"
          >
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={cn("transition-transform duration-[170ms]", stepsOpen && "rotate-180")}
            />
            {testCase.steps.length} steps
          </button>

          {stepsOpen && (
            <ol className="border-muted mt-2.5 flex flex-col gap-1.5 border-l pl-4">
              {testCase.steps.map((s, i) => (
                <li key={i} className="text-body-md text-secondary flex gap-2">
                  <span className="text-quaternary tabular shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label="Edit test case"
            className="icon-quaternary hover:icon-secondary hover:bg-raised grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[170ms]"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Regenerate test case"
            className="icon-quaternary hover:icon-secondary hover:bg-raised grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[170ms]"
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Delete test case"
            className="icon-quaternary hover:text-error hover:bg-raised grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[170ms]"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function TestPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cases, setCases] = useState(testPlan);
  const [openJourneys, setOpenJourneys] = useState<string[]>(["checkout", "cart"]);

  const toggleApprove = (caseId: string) =>
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, approved: !c.approved } : c)),
    );

  const approvedShown = cases.filter((c) => c.approved).length;
  // The demo plan holds 42 scenarios; this page renders a representative slice.
  const approvedTotal = planStats.approved - (testPlan.filter((c) => c.approved).length - approvedShown);
  const pct = Math.round((approvedTotal / planStats.total) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 px-5 py-5 pb-28">
          {/* ---- Header ---- */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-heading-lg text-primary">
                Proposed test plan &mdash; {planStats.total} scenarios
              </h1>
              <p className="text-body-md text-tertiary mt-1.5 max-w-2xl">
                Written in plain language before any code exists. Approve, edit or regenerate each
                scenario. Nothing is generated until you say so.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone="success">{planStats.happy} happy path</Chip>
                <Chip tone="warning">{planStats.edge} edge case</Chip>
                <Chip tone="error">{planStats.negative} negative</Chip>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button icon={Plus}>Add scenario</Button>
              <Button icon={RotateCcw}>Regenerate</Button>
              <Button
                icon={Check}
                onClick={() => setCases((prev) => prev.map((c) => ({ ...c, approved: true })))}
              >
                Approve all
              </Button>
            </div>
          </div>

          {/* ---- Journey groups ---- */}
          {journeys.map((journey) => {
            const grouped = cases.filter((c) => c.journey === journey.id);
            if (grouped.length === 0) return null;
            const open = openJourneys.includes(journey.id);

            return (
              <section key={journey.id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenJourneys((prev) =>
                      prev.includes(journey.id)
                        ? prev.filter((j) => j !== journey.id)
                        : [...prev, journey.id],
                    )
                  }
                  aria-expanded={open}
                  className="flex w-full items-center gap-2.5 py-2 text-left"
                >
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={cn(
                      "icon-tertiary shrink-0 transition-transform duration-[170ms]",
                      !open && "-rotate-90",
                    )}
                  />
                  <span className="text-heading-sm text-primary">{journey.name}</span>
                  <Chip>{journey.cases}</Chip>
                  <span className="text-body-sm text-quaternary hidden truncate md:block">
                    {journey.description}
                  </span>
                </button>

                {open && (
                  <div className="mt-2 flex flex-col gap-2.5">
                    {grouped.map((c) => (
                      <TestCaseCard
                        key={c.id}
                        testCase={c}
                        onToggleApprove={() => toggleApprove(c.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <Card>
            <p className="text-body-md text-tertiary">
              Showing {cases.length} of {planStats.total} scenarios. Expand a journey group above
              to review the rest.
            </p>
          </Card>
        </div>
      </div>

      {/* ---- Sticky approval footer ---- */}
      <div className="border-muted bg-container/95 sticky bottom-0 border-t px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-label-md text-primary tabular">
                {approvedTotal} of {planStats.total} approved
              </span>
              <span className="text-label-sm text-tertiary tabular">{pct}%</span>
            </div>
            <ProgressBar value={pct} className="mt-1.5" />
          </div>

          <Link href={`/projects/${id}/tests`}>
            <Button variant="primary" icon={ArrowRight} disabled={approvedTotal === 0}>
              Generate tests from approved plan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
