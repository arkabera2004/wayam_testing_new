"use client";

import { AppIcon } from "@/components/ui/app-icon";

import { useState } from "react";
import Link from "next/link";

import { Button, Card, Chip, ProgressBar, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { useToast } from "@/components/ui/toast";
import type { PlanJourney } from "@/db/queries";

type PlanCase = PlanJourney["cases"][number];

/** Priority drives the chip colour now that the rows carry no tag list. */
function TagTone(priority: string) {
  if (priority === "critical") return "error" as const;
  if (priority === "high") return "warning" as const;
  if (priority === "low") return "success" as const;
  return "neutral" as const;
}

function TestCaseCard({
  testCase,
  onToggleApprove,
  onRegenerate,
  onDelete,
}: {
  testCase: PlanCase & { journey: string };
  onToggleApprove: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
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
          {testCase.approved ? <AppIcon name="check" size="xs" aria-hidden="true" /> : null}
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
                {testCase.executable ? (
                  <AppIcon name="sparkle" size="sm" className="text-success mt-1 shrink-0" aria-hidden="true" />
                ) : null}
                <span>{title}</span>
              </p>
              <p className="text-body-md text-tertiary mt-1.5">
                <span className="text-quaternary">Expect:</span> {testCase.expectation}
              </p>
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip tone={TagTone(testCase.priority)}>{testCase.priority}</Chip>
            <Chip>{testCase.type}</Chip>
            {testCase.executable ? <Chip tone="success">executable</Chip> : null}
          </div>

          <button
            type="button"
            onClick={() => setStepsOpen((o) => !o)}
            aria-expanded={stepsOpen}
            className="text-label-sm text-tertiary hover:text-primary mt-3 flex items-center gap-1.5 transition-colors duration-[170ms]"
          >
            <AppIcon name="chevronDown"
              size="xs"
              aria-hidden="true"
              className={cn("transition-transform duration-[170ms]", stepsOpen && "rotate-180")}
            />
            {testCase.steps.length} steps
          </button>

          {stepsOpen && (
            <ol className="border-muted mt-2.5 flex flex-col gap-1.5 border-l pl-4">
              {testCase.steps.map((s: string, i: number) => (
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
            <AppIcon name="edit" size="xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            aria-label="Regenerate test case"
            className="icon-quaternary hover:icon-secondary hover:bg-raised grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[170ms]"
          >
            <AppIcon name="refresh" size="xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete test case"
            className="icon-quaternary hover:text-error hover:bg-raised grid h-7 w-7 place-items-center rounded-lg transition-colors duration-[170ms]"
          >
            <AppIcon name="delete" size="xs" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function PlanView({
  id,
  journeys,
  stats,
}: {
  id: string;
  journeys: PlanJourney[];
  stats: { total: number; approved: number; byPriority: Record<string, number> };
}) {
  const [cases, setCases] = useState(journeys.flatMap((j) => j.cases.map((c) => ({ ...c, journey: j.id }))));
  const { toast } = useToast();
  const [openJourneys, setOpenJourneys] = useState<string[]>(journeys.slice(0, 2).map((j) => j.id));

  const toggleApprove = (caseId: string) =>
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, approved: !c.approved } : c)),
    );

  const approvedShown = cases.filter((c) => c.approved).length;
  // The demo plan holds 42 scenarios; this page renders a representative slice.
  const approvedTotal = approvedShown;
  const pct = stats.total ? Math.round((approvedTotal / stats.total) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 px-5 py-5 pb-28">
          {/* ---- Header ---- */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-heading-lg text-primary">
                Proposed test plan &mdash; {stats.total} scenarios
              </h1>
              <p className="text-body-md text-tertiary mt-1.5 max-w-2xl">
                Written in plain language before any code exists. Approve, edit or regenerate each
                scenario. Nothing is generated until you say so.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(stats.byPriority).map(([priority, n]) => (
                  <Chip
                    key={priority}
                    tone={priority === "critical" ? "error" : priority === "high" ? "warning" : "neutral"}
                  >
                    {n} {priority}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <ActionButton icon="add" title="Add scenario" body="Manual scenario authoring arrives with the editor.">Add scenario</ActionButton>
              <ActionButton icon="refresh" title="Regenerating plan" body="Parikshan re-reads the requirements and proposes a fresh set.">Regenerate</ActionButton>
              <Button
                icon="check"
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
                  <AppIcon name="chevronDown"
                    size="sm"
                    aria-hidden="true"
                    className={cn(
                      "icon-tertiary shrink-0 transition-transform duration-[170ms]",
                      !open && "-rotate-90",
                    )}
                  />
                  <span className="text-heading-sm text-primary">{journey.name}</span>
                  <Chip>{journey.cases.length}</Chip>
                  <span className="text-body-sm text-quaternary hidden truncate md:block">
                    {journey.cases.filter((c) => c.approved).length} of {journey.cases.length} approved
                  </span>
                </button>

                {open && (
                  <div className="mt-2 flex flex-col gap-2.5">
                    {grouped.map((c) => (
                      <TestCaseCard
                        key={c.id}
                        testCase={c}
                        onToggleApprove={() => toggleApprove(c.id)}
                        onRegenerate={() =>
                          toast({
                            tone: "info",
                            title: "Regenerating scenario",
                            body: `Parikshan is rewriting "${c.title}".`,
                          })
                        }
                        onDelete={() => {
                          setCases((prev) => prev.filter((x) => x.id !== c.id));
                          toast({ tone: "warning", title: "Scenario removed", body: c.title });
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {stats.total === 0 ? (
            /* "Showing 0 of 0" told the reader nothing about why it was empty
               or what to do next. A plan has to come from somewhere. */
            <Card title="No scenarios yet">
              <p className="text-body-md text-tertiary">
                A test plan is written from something: requirements you paste, or the routes found
                by importing a repository. Neither has produced scenarios for this project yet.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/projects/${id}/prd/new`}>
                  <Button variant="primary">Start from requirements</Button>
                </Link>
                <Link href={`/projects/${id}/repo-baseline`}>
                  <Button variant="secondary">Import a repository</Button>
                </Link>
                <Link href={`/projects/${id}/discovery`}>
                  <Button variant="secondary">See what was discovered</Button>
                </Link>
              </div>
              <p className="text-body-sm text-quaternary mt-4">
                Turning discovered routes into written scenarios is not wired yet, so scenarios
                currently come from requirements or seeded data.
              </p>
            </Card>
          ) : (
            <Card>
              <p className="text-body-md text-tertiary">
                Showing {cases.length} of {stats.total} scenarios. Expand a journey group above
                to review the rest.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ---- Sticky approval footer ---- */}
      <div className="border-muted bg-container/95 sticky bottom-0 border-t px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-48 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-label-md text-primary tabular">
                {approvedTotal} of {stats.total} approved
              </span>
              <span className="text-label-sm text-tertiary tabular">{pct}%</span>
            </div>
            <ProgressBar value={pct} className="mt-1.5" />
          </div>

          <Link href={`/projects/${id}/tests`}>
            <Button variant="primary" icon="arrowRight" disabled={approvedTotal === 0}>
              Generate tests from approved plan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
