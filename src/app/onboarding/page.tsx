"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProjectSourcePicker } from "@/components/project-source-picker";
import { Button, cn } from "@/components/ui";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";
import { project } from "@/lib/demo-data";

const STEPS = ["Workspace", "Project", "First discovery"];

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

export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <div className="bg-page text-primary h-screen w-screen overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
        {/* Stepper */}
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

        {/* Step body */}
        {step === 0 && (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="text-heading-lg text-primary">Set up your workspace</h1>
              <p className="text-body-md text-tertiary mt-1.5">
                This is where your projects, runs and team live.
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
              <h1 className="text-heading-lg text-primary">Point Parikshan at your app</h1>
              <p className="text-body-md text-tertiary mt-1.5">
                Connect a repository for deeper context, or paste a URL to start immediately.
              </p>
            </div>
            <ProjectSourcePicker />
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="text-heading-lg text-primary">Ready to explore</h1>
              <p className="text-body-md text-tertiary mt-1.5">
                Here is what happens next. It takes about two minutes.
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {([
                { icon: "crawl", title: "Crawl up to 100 pages", body: "Following links, forms and navigation like a real user." },
                { icon: "network-capture", title: "Capture network calls", body: "Every request becomes a candidate for API-level tests." },
                { icon: "journey", title: "Build your application map", body: "Pages, journeys and endpoints, ready for planning." },
              ] as Array<{ icon: Icon3DName; title: string; body: string }>).map((item) => (
                <li key={item.title} className="border-muted bg-container flex items-center gap-3.5 rounded-xl border p-4">
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

        {/* Footer nav */}
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
            <Link href={`/projects/${project.id}/discovery`}>
              <Button variant="primary" icon={ArrowRight}>
                Start discovery
              </Button>
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
