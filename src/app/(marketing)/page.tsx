import Link from "next/link";
import { ArrowRight, Check, Github, Play, X } from "lucide-react";

import { Button, Card, Chip, cn } from "@/components/ui";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";

const HOW_IT_WORKS: Array<{ icon: Icon3DName; title: string; body: string }> = [
  { icon: "connect", title: "Connect", body: "Paste a URL or connect a GitHub repository." },
  { icon: "explore", title: "AI explores", body: "Parikshan crawls pages, journeys and network calls." },
  { icon: "review-plan", title: "Review the plan", body: "Approve tests in plain language before any code." },
  { icon: "self-heal", title: "Run and self-heal", body: "Cloud runs on every PR; broken locators heal themselves." },
];

const FEATURES: Array<{ icon: Icon3DName; title: string; body: string }> = [
  { icon: "ingestion", title: "Repo or URL ingestion", body: "No config files, no framework setup. Authenticated flows included." },
  { icon: "human-approval", title: "Human-in-the-loop plans", body: "Every scenario is proposed in plain language and approved by you." },
  { icon: "readable-code", title: "Readable Playwright output", body: "Real TypeScript that lives in your repo. Diff it, edit it, own it." },
  { icon: "parallel-runs", title: "Cloud parallel runs", body: "Chromium, Firefox and WebKit in parallel shards, minutes not hours." },
  { icon: "healing-locators", title: "Self-healing locators", body: "Interface changed? The selector updates itself and the suite stays green." },
  { icon: "quarantine", title: "Flaky quarantine", body: "Unstable tests are detected and isolated before they block a release." },
];

const COMPARISON = [
  { label: "Time to first suite", ours: "Minutes", theirs: "Weeks" },
  { label: "Generated code", ours: "Editable Playwright in your repo", theirs: "Black-box recorder" },
  { label: "Maintenance", ours: "Locators self-heal", theirs: "Manual selector fixes" },
  { label: "Pricing", ours: "Usage-based", theirs: "Per seat" },
  { label: "Review before generation", ours: "Plain-language plan you approve", theirs: "None" },
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
            Paste a URL or repo. Get a runnable test suite in minutes.
          </h1>

          <p className="text-body-lg text-secondary mx-auto mt-5 max-w-2xl text-pretty">
            Parikshan&rsquo;s AI explores your app, proposes tests in plain language, and generates
            Playwright code you own.
          </p>

          {/* UrlInput */}
          <form className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <label htmlFor="hero-url" className="sr-only">
              Your application URL
            </label>
            <input
              id="hero-url"
              type="url"
              defaultValue="https://shopstack.demo"
              placeholder="https://your-app.com"
              className={cn(
                "border-muted bg-container text-body-lg text-primary placeholder:text-quaternary",
                "h-11 min-w-0 flex-1 rounded-lg border px-3.5",
                "focus-visible:border-active focus-visible:outline-none",
              )}
            />
            <Link href="/onboarding" className="shrink-0">
              <Button variant="primary" icon={ArrowRight} className="h-11 w-full px-5 sm:w-auto">
                Generate tests
              </Button>
            </Link>
          </form>

          <p className="text-body-sm text-tertiary mt-3">
            or{" "}
            <Link href="/onboarding" className="text-secondary hover:text-primary underline underline-offset-4">
              connect GitHub
            </Link>
          </p>

          <div className="text-caption text-quaternary mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span>Playwright-native</span>
            <span aria-hidden="true">·</span>
            <span>SOC 2 roadmap</span>
            <span aria-hidden="true">·</span>
            <span>Free tier</span>
          </div>
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
              <p className="text-label-md text-tertiary">Watch the 3-minute product demo</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" className="border-muted border-t">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-heading-lg text-primary">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
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
          <h2 className="text-heading-lg text-primary">Everything the suite needs</h2>
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
              &ldquo;We replaced three weeks of Selenium maintenance with a suite that fixes its own
              selectors. The plan review is what made the team trust it.&rdquo;
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
            From repository to reliable tests in under ten minutes.
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href="/signup">
              <Button variant="primary" icon={ArrowRight} className="h-11 px-5">
                Start free
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button icon={Github} className="h-11 px-5">
                Connect GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
