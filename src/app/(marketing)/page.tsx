import Link from "next/link";
import { ArrowRight, Check, FileText, Github, Globe, Play, X } from "lucide-react";

import { Button, Card, Chip, cn } from "@/components/ui";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";

const HOW_IT_WORKS: Array<{ icon: Icon3DName; title: string; body: string }> = [
  {
    icon: "prd-extract",
    title: "Requirements in",
    body: "Upload an SRS, user stories, or Jira tickets - or start from a live app.",
  },
  {
    icon: "prd-ambiguity",
    title: "Requirement intelligence",
    body: "Flag ambiguous, duplicate, untestable, and missing edge-case requirements.",
  },
  {
    icon: "prd-traceability",
    title: "Scenarios & traceability",
    body: "Requirements become test scenarios with a living requirement ↔ test link.",
  },
  {
    icon: "ingestion",
    title: "Application input",
    body: "Connect GitHub or a live URL. Authenticated areas included.",
  },
  {
    icon: "explore",
    title: "Application exploration",
    body: "Pages, user flows, APIs, and structure - mapped like a real user.",
  },
  {
    icon: "prd-classify",
    title: "Reconcile should vs does",
    body: "Find missing functionality, uncovered requirements, and incorrect behavior.",
  },
  {
    icon: "readable-code",
    title: "Playwright you own",
    body: "Reviewable TypeScript in your repo. Diff it, edit it, keep it.",
  },
  {
    icon: "self-heal",
    title: "Execute & change intelligence",
    body: "Multi-browser evidence, locator healing, and targeted regression on change.",
  },
];

const FEATURES: Array<{ icon: Icon3DName; title: string; body: string }> = [
  {
    icon: "prd-extract",
    title: "Requirements-first entry",
    body: "Test before code exists. SRS, stories, and Jira are first-class inputs - not an afterthought.",
  },
  {
    icon: "prd-ambiguity",
    title: "Requirement intelligence",
    body: "Ambiguity, duplicates, untestable wording, missing boundaries, and dependencies - surfaced early.",
  },
  {
    icon: "prd-traceability",
    title: "Requirement ↔ test traceability",
    body: "Every generated case points back to the requirement that justified it.",
  },
  {
    icon: "ingestion",
    title: "Repo or live URL",
    body: "Explore existing apps with GitHub context or a URL. Auth credentials when you need them.",
  },
  {
    icon: "readable-code",
    title: "Readable Playwright output",
    body: "Real TypeScript that lives in your repo. Customer-owned, reviewable, modifiable.",
  },
  {
    icon: "healing-locators",
    title: "Execution + change intelligence",
    body: "Chromium, Firefox, WebKit with evidence. When requirements or code change, only the right tests run.",
  },
];

const COMPARISON = [
  { label: "Start before code exists", ours: "Requirements → scenarios → tests", theirs: "Wait until the UI ships" },
  { label: "Entry points", ours: "SRS / stories / Jira or GitHub / URL", theirs: "Recorder against a live page" },
  { label: "Generated code", ours: "Editable Playwright in your repo", theirs: "Black-box recorder" },
  { label: "Requirements ↔ app", ours: "Reconcile should vs does", theirs: "None" },
  { label: "Maintenance", ours: "Healing + change-aware regression", theirs: "Manual selector fixes" },
];

const ENTRY_PATHS = [
  {
    href: "/onboarding?path=requirements",
    icon: FileText,
    title: "Start from requirements",
    body: "Upload SRS, user stories, or Jira. Analyse ambiguity, generate scenarios, and keep traceability - even before development.",
    cta: "Upload requirements",
    pathLabel: "Path A · Pre-development",
    primary: true,
  },
  {
    href: "/onboarding?path=application",
    icon: Globe,
    title: "Start from your application",
    body: "Connect GitHub or paste a live URL. Explore pages and APIs, assess coverage, and generate the tests that are still missing.",
    cta: "Connect your app",
    pathLabel: "Path B · Existing app",
    primary: false,
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <Chip tone="neutral" className="mx-auto">
            A Wayam AI product
          </Chip>

          <h1 className="font-display text-display-page text-primary mt-6 text-balance">
            From requirements to Playwright tests - before or after you ship.
          </h1>

          <p className="text-body-lg text-secondary mx-auto mt-5 max-w-2xl text-pretty">
            Parikshan analyses what the application <em>should</em> do and what it{" "}
            <em>actually</em> does, then generates reviewable Playwright tests you own -
            with requirement ↔ test traceability and change intelligence.
          </p>
        </div>

        {/* Dual entry cards */}
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          {ENTRY_PATHS.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              className={cn(
                "border-muted bg-container group flex flex-col rounded-2xl border p-6 text-left",
                "transition-[border-color,background-color] duration-[170ms] hover:bg-raised",
                path.primary && "border-active",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full",
                    path.primary ? "bg-action-primary icon-on-color" : "bg-raised-2 icon-tertiary",
                  )}
                >
                  <path.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-caption text-quaternary">{path.pathLabel}</span>
              </div>
              <p className="text-heading-sm text-primary mt-4">{path.title}</p>
              <p className="text-body-md text-tertiary mt-2 flex-1">{path.body}</p>
              <span
                className={cn(
                  "text-label-md mt-5 inline-flex items-center gap-1.5",
                  path.primary ? "text-primary" : "text-secondary",
                )}
              >
                {path.cta}
                <ArrowRight
                  size={14}
                  className="transition-transform duration-[170ms] group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>

        <p className="text-body-sm text-tertiary mt-5 text-center">
          Scope a whole application, a single file, one requirement, or a particular code change.
        </p>

        <div className="text-caption text-quaternary mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <span>Playwright-native</span>
          <span aria-hidden="true">·</span>
          <span>Requirements ↔ tests</span>
          <span aria-hidden="true">·</span>
          <span>Free tier</span>
        </div>

        {/* DemoVideoEmbed */}
        <div className="border-muted bg-container mt-14 overflow-hidden rounded-2xl border">
          <div className="border-muted bg-raised flex items-center gap-3 border-b px-3 py-2">
            <div className="flex gap-1.5">
              <span className="bg-raised-2 h-2.5 w-2.5 rounded-full" />
              <span className="bg-raised-2 h-2.5 w-2.5 rounded-full" />
              <span className="bg-raised-2 h-2.5 w-2.5 rounded-full" />
            </div>
            <div className="bg-container text-body-sm text-tertiary flex-1 truncate rounded-md px-2.5 py-1">
              app.parikshan.dev/projects/shopstack
            </div>
          </div>
          <div className="grid aspect-video place-items-center">
            <div className="flex flex-col items-center gap-3">
              <span className="bg-action-primary icon-on-color grid h-12 w-12 place-items-center rounded-full">
                <Play size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <p className="text-label-md text-tertiary">Watch the product demo</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" className="border-muted border-t">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-2xl">
            <h2 className="text-heading-lg text-primary">The Parikshan flow</h2>
            <p className="text-body-md text-tertiary mt-2">
              Requirements are the first-class entry point. Application exploration joins when
              you have a repo or URL - and the intelligence layer reconciles both.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="border-muted bg-container rounded-xl border p-5">
                <div className="flex items-center justify-between gap-2.5">
                  <Icon3D name={step.icon} size={56} />
                  <span className="text-caption text-quaternary tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-heading-sm text-primary mt-4">{step.title}</p>
                <p className="text-body-md text-tertiary mt-1.5">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="border-muted border-t">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-heading-lg text-primary">Built for entire apps and single changes</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-muted bg-container rounded-xl border p-5">
                <Icon3D name={f.icon} size={56} />
                <p className="text-heading-sm text-primary mt-4">{f.title}</p>
                <p className="text-body-md text-tertiary mt-1.5">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Differentiator table ---------------- */}
      <section className="border-muted border-t">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-heading-lg text-primary">Parikshan vs legacy test management</h2>
          <Card className="mt-8" padded={false}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="text-label-sm text-tertiary border-muted border-b px-4 py-3 font-medium">
                    &nbsp;
                  </th>
                  <th className="text-label-sm text-primary border-muted border-b px-4 py-3 font-medium">
                    Parikshan
                  </th>
                  <th className="text-label-sm text-tertiary border-muted border-b px-4 py-3 font-medium">
                    Legacy tools
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label}>
                    <td className="text-body-md text-tertiary border-muted border-b px-4 py-3">
                      {row.label}
                    </td>
                    <td className="text-body-md text-primary border-muted border-b px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Check size={14} className="text-success shrink-0" aria-hidden="true" />
                        {row.ours}
                      </span>
                    </td>
                    <td className="text-body-md text-quaternary border-muted border-b px-4 py-3">
                      <span className="flex items-center gap-2">
                        <X size={14} className="shrink-0" aria-hidden="true" />
                        {row.theirs}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* ---------------- Social proof ---------------- */}
      <section className="border-muted border-t">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-40">
            {["NORTHWIND", "CONTOSO", "UMBRA", "LATTICE", "MERIDIAN"].map((logo) => (
              <span key={logo} className="font-display text-display-xs text-tertiary">
                {logo}
              </span>
            ))}
          </div>

          <Card className="mx-auto mt-10 max-w-2xl">
            <blockquote className="text-body-lg text-secondary text-pretty">
              &ldquo;We started from the SRS before the feature shipped. By the time checkout
              landed, the suite already knew which requirements were covered - and which the
              build still missed.&rdquo;
            </blockquote>
            <div className="mt-4 flex items-center gap-2.5">
              <span className="bg-raised-2 text-secondary text-label-sm grid h-7 w-7 place-items-center rounded-full">
                RK
              </span>
              <div>
                <p className="text-label-md text-primary">Rhea Kapoor</p>
                <p className="text-caption text-quaternary">QA Lead, Northwind</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ---------------- CTA banner ---------------- */}
      <section className="border-muted border-t">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-display-page text-primary text-balance">
            Requirements in. Reliable Playwright out.
          </h2>
          <p className="text-body-lg text-secondary mx-auto mt-4 max-w-2xl">
            Start from what the product should do - or from the app you already have.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href="/onboarding?path=requirements">
              <Button variant="primary" icon={ArrowRight} className="h-11 px-5">
                Start from requirements
              </Button>
            </Link>
            <Link href="/onboarding?path=application">
              <Button icon={Github} className="h-11 px-5">
                Connect your app
              </Button>
            </Link>
          </div>
          <p className="text-body-sm text-tertiary mx-auto mt-5 max-w-xl text-pretty">
            Your data stays on your system. Prefer fully local? Run with open-source LLMs so
            nothing leaves your environment.
          </p>
        </div>
      </section>
    </>
  );
}
