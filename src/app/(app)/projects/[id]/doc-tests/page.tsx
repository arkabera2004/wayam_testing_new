"use client";

import { useState } from "react";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, Chip, PageHeader, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { useToast } from "@/components/ui/toast";
import { docTests, type DocScenario } from "@/lib/demo-data";

/**
 * Ported from AIDLC-Azure's Doc-Driven Tests, including its three-step shape:
 * upload a document, review the scenarios pulled out of it, then generate
 * specs from the ones you approve. The parse is pre-computed here since there
 * is no model to call, but the selection and the step gating are real.
 */
const TAG_TONE: Record<DocScenario["tag"], "success" | "warning" | "error"> = {
  "happy-path": "success",
  "edge-case": "warning",
  negative: "error",
};

const STEPS = ["Document", "Scenarios", "Generate"] as const;

export default function DocTestsPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [scenarios, setScenarios] = useState<DocScenario[]>(docTests.scenarios);

  const chosen = scenarios.filter((s) => s.selected);
  const toggle = (id: string) =>
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));

  return (
    <PageBody>
      <PageHeader
        title="Doc-Driven Tests"
        description="Point Parikshan at a spec and it proposes scenarios traced back to the section they came from."
      />

      {/* ---- Step rail ---- */}
      <div className="border-muted bg-container mb-5 flex flex-wrap items-center gap-2 rounded-xl border p-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            aria-current={step === i ? "step" : undefined}
            className={cn(
              "text-label-md flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors duration-[170ms]",
              step === i ? "bg-action-primary text-on-color" : "text-tertiary hover:text-primary hover:bg-raised",
            )}
          >
            <span
              className={cn(
                "text-caption tabular grid h-5 w-5 place-items-center rounded-full",
                step === i ? "bg-page/20" : "bg-raised-2",
              )}
            >
              {i + 1}
            </span>
            {label}
            {i === 1 && <Chip tone="neutral">{scenarios.length}</Chip>}
          </button>
        ))}
      </div>

      {/* ---- Step 1: document ---- */}
      {step === 0 && (
        <Card title="Source document" subtitle="Markdown, plain text, PDF, Word, JSON, YAML or CSV">
          <div className="border-muted bg-raised/40 flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <AppIcon name="docs" size="3xl" className="icon-quaternary" />
            <p className="text-label-md text-primary mt-1">{docTests.document.name}</p>
            <p className="text-caption text-quaternary">
              {docTests.document.size} · {docTests.document.sections} sections · parsed {docTests.document.parsedAt}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {docTests.accepted.map((e) => (
                <Chip key={e}>{e}</Chip>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <ActionButton
                icon="download"
                title="Upload unavailable"
                body="File upload needs storage, which this build does not have."
              >
                Replace document
              </ActionButton>
              <Button variant="primary" onClick={() => setStep(1)}>
                Review {scenarios.length} scenarios
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ---- Step 2: scenarios ---- */}
      {step === 1 && (
        <Card
          title="Extracted scenarios"
          subtitle="Each one traces back to the section it came from"
          padded={false}
          actions={
            <span className="text-label-sm text-tertiary tabular">
              {chosen.length} of {scenarios.length} selected
            </span>
          }
        >
          <ul className="divide-muted flex flex-col divide-y">
            {scenarios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={s.selected}
                  className="hover:bg-raised flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-[170ms]"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-[170ms]",
                      s.selected ? "bg-success-icon border-transparent" : "border-default",
                    )}
                  >
                    {s.selected && <AppIcon name="check" size="xs" className="text-on-solid" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-label-md text-primary">{s.title}</p>
                    <p className="text-body-sm text-tertiary mt-1">{s.expectation}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip tone={TAG_TONE[s.tag]}>{s.tag}</Chip>
                      <span className="text-caption text-quaternary">{s.source}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-muted flex justify-end gap-2 border-t px-4 py-3">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => setStep(2)}>
              Generate {chosen.length} test{chosen.length === 1 ? "" : "s"}
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step 3: generate ---- */}
      {step === 2 && (
        <Card title="Ready to generate" subtitle="These become Playwright specs you own">
          <ul className="flex flex-col gap-2">
            {chosen.map((s) => (
              <li key={s.id} className="bg-raised flex items-center gap-2.5 rounded-lg px-3 py-2">
                <AppIcon name="check" size="sm" className="text-success" />
                <span className="text-body-md text-secondary min-w-0 flex-1 truncate">{s.title}</span>
                <Chip tone={TAG_TONE[s.tag]}>{s.tag}</Chip>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                toast({
                  tone: "success",
                  title: `${chosen.length} specs generated`,
                  body: "They are waiting for approval in the test plan.",
                })
              }
            >
              Generate specs
            </Button>
          </div>
        </Card>
      )}
    </PageBody>
  );
}
