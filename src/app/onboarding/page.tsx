"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ProjectEntryPicker,
  type EntryPath,
} from "@/components/project-entry-picker";
import { Button, cn } from "@/components/ui";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";
import { project } from "@/lib/demo-data";

const STEPS = ["Workspace", "Entry point", "What happens next"];

function Field({
  id,
  label,
  defaultValue,
}: {
  id: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md text-secondary">
        {label}
      </label>
      <input
        id={id}
        defaultValue={defaultValue}
        className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-3 focus-visible:outline-none"
      />
    </div>
  );
}

function Select({ id, label, options }: { id: string; label: string; options: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md text-secondary">
        {label}
      </label>
      <select
        id={id}
        className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-2.5 focus-visible:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

const REQUIREMENTS_NEXT: Array<{ icon: Icon3DName; title: string; body: string }> = [
  {
    icon: "prd-extract",
    title: "Extract atomic requirements",
    body: "Split compound statements into testable units with clear ownership.",
  },
  {
    icon: "prd-ambiguity",
    title: "Run requirement intelligence",
    body: "Flag ambiguity, duplicates, untestable wording, and missing edge cases.",
  },
  {
    icon: "prd-generate",
    title: "Propose scenarios with traceability",
    body: "Every case links back to the requirement that justified it.",
  },
];

const APPLICATION_NEXT: Array<{ icon: Icon3DName; title: string; body: string }> = [
  {
    icon: "crawl",
    title: "Explore the application",
    body: "Crawl pages, journeys, and authenticated areas like a real user.",
  },
  {
    icon: "network-capture",
    title: "Inventory APIs and structure",
    body: "Network calls and routes become candidates for deeper coverage.",
  },
  {
    icon: "prd-classify",
    title: "Assess coverage gaps",
    body: "See what exists today, then generate the missing tests.",
  },
];

function OnboardingInner() {
  const searchParams = useSearchParams();
  const initialPath: EntryPath =
    searchParams.get("path") === "application" ? "application" : "requirements";

  const [step, setStep] = useState(0);
  const [entryPath, setEntryPath] = useState<EntryPath>(initialPath);

  const nextItems = entryPath === "requirements" ? REQUIREMENTS_NEXT : APPLICATION_NEXT;
  const finishHref =
    entryPath === "requirements"
      ? `/projects/${project.id}/prd/new`
      : `/projects/${project.id}/discovery`;
  const finishLabel =
    entryPath === "requirements" ? "Analyse requirements" : "Start exploration";

  const stepCopy = useMemo(() => {
    if (entryPath === "requirements") {
      return {
        title: "Ready to analyse requirements",
        body: "Here is what happens next. You can attach a GitHub repo or live URL later to reconcile should vs does.",
      };
    }
    return {
      title: "Ready to explore your application",
      body: "Here is what happens next. You can add requirements anytime to close coverage gaps against the spec.",
    };
  }, [entryPath]);

  return (
    <div className="bg-page text-primary h-screen w-screen overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Parikshan home" className="flex items-center">
              <Wordmark height={32} />
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/projects"
                className="text-label-md text-tertiary hover:text-primary transition-colors duration-[170ms]"
              >
                Skip for now
              </Link>
            </div>
          </div>

          <ol className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-label-sm transition-colors duration-[170ms]",
                    i < step && "bg-action-primary text-on-color",
                    i === step && "bg-action-primary text-on-color",
                    i > step && "bg-raised text-quaternary",
                  )}
                >
                  {i < step ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-label-md truncate",
                    i <= step ? "text-primary" : "text-quaternary",
                  )}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && <span className="border-muted h-px flex-1 border-t" />}
              </li>
            ))}
          </ol>
        </header>

        {step === 0 && (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="text-heading-lg text-primary">Set up your workspace</h1>
              <p className="text-body-md text-tertiary mt-1.5">
                This is where your projects, requirements, runs and team live.
              </p>
            </div>
            <Field id="ws-name" label="Workspace name" defaultValue="Acme Inc" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select id="ws-size" label="Team size" options={["1–10", "11–50", "51–200", "200+"]} />
              <Select
                id="ws-role"
                label="Your role"
                options={["QA lead", "Developer", "Engineering manager", "Founder"]}
              />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="text-heading-lg text-primary">How do you want to start?</h1>
              <p className="text-body-md text-tertiary mt-1.5">
                Requirements-first for pre-development, or application-first for what already
                exists. You can combine both later.
              </p>
            </div>
            <ProjectEntryPicker initialPath={entryPath} onPathChange={setEntryPath} />
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="text-heading-lg text-primary">{stepCopy.title}</h1>
              <p className="text-body-md text-tertiary mt-1.5">{stepCopy.body}</p>
            </div>

            <ul className="flex flex-col gap-3">
              {nextItems.map((item) => (
                <li
                  key={item.title}
                  className="border-muted bg-container flex items-center gap-3.5 rounded-xl border p-4"
                >
                  <Icon3D name={item.icon} size={52} />
                  <div>
                    <p className="text-heading-sm text-primary">{item.title}</p>
                    <p className="text-body-md text-tertiary mt-1">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex items-center justify-between">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>

          {step < 2 ? (
            <Button variant="primary" icon={ArrowRight} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Link href={finishHref}>
              <Button variant="primary" icon={ArrowRight}>
                {finishLabel}
              </Button>
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-page text-primary grid h-screen w-screen place-items-center">
          <p className="text-body-md text-tertiary">Loading onboarding…</p>
        </div>
      }
    >
      <OnboardingInner />
    </Suspense>
  );
}
