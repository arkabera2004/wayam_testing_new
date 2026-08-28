import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GitBranch,
  Sparkles,
  PlayCircle,
  BarChart3,
  ArrowRight,
  Check,
  Github,
  Slack,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WayamMark } from "@/components/brand/wayam-mark";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const STEPS = [
  {
    icon: GitBranch,
    title: "Connect a repo or URL",
    description: "Paste a GitHub repository or a live app URL — no config files, no agents to install.",
  },
  {
    icon: Sparkles,
    title: "AI generates a test plan",
    description: "Get editable, plain-English scenarios across E2E, API, regression, a11y, and visual.",
  },
  {
    icon: PlayCircle,
    title: "Run the suite",
    description: "Accept scenarios, generate runnable code, and execute on demand, on a schedule, or on every PR.",
  },
  {
    icon: BarChart3,
    title: "See coverage & trends",
    description: "Track pass/fail history, flaky tests, and risk by feature area from one dashboard.",
  },
];

const FEATURES = [
  {
    title: "Human-in-the-loop test plans",
    description: "Every AI-generated scenario is a card you can accept, edit, or reject before it becomes code.",
  },
  {
    title: "Multi-tenant by design",
    description: "Every workspace is fully isolated — bring your whole team in without data ever crossing over.",
  },
  {
    title: "Flaky test detection",
    description: "Parikshan tracks inconsistent results across runs and surfaces a flaky-test leaderboard automatically.",
  },
  {
    title: "CI-native",
    description: "Connect GitHub to run your suite on every pull request, with Slack and Jira wired in for the fallout.",
  },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For solo builders validating a first project.",
    features: ["1 project", "100 test executions / mo", "E2E + API scenarios", "Community support"],
    cta: "Start free",
  },
  {
    name: "Team",
    price: "$49",
    cadence: "per month, usage-based beyond included runs",
    description: "For teams shipping weekly that need CI-grade coverage.",
    features: [
      "Unlimited projects",
      "5,000 test executions / mo included",
      "Run on every PR",
      "Slack + Jira integrations",
      "Flaky-test detection",
    ],
    cta: "Start free",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "volume pricing & SSO",
    description: "For orgs that need scale, security review, and a dedicated pipeline.",
    features: [
      "Everything in Team",
      "SSO & audit logs",
      "Dedicated execution capacity",
      "Custom data retention",
      "Solutions engineering",
    ],
    cta: "Talk to sales",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <WayamMark className="h-10 w-10" />
            <span className="font-display text-sm tracking-tight">Parikshan</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="surface-hero relative overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
            AI-powered software testing
          </Badge>
          <h1 className="font-display text-4xl tracking-tight text-balance sm:text-6xl">
            Ship weekly without a manual QA team
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Connect a repo or a live URL. Parikshan generates an editable test plan, turns it into
            runnable code, executes it, and reports coverage — all from one dashboard.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="glow-ring" asChild>
              <Link to="/signup">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">See a live dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <h2 className="font-display text-3xl tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">From URL to coverage report in four steps.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="card-elevated border-border/60 bg-card/60">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">
                  <span className="mr-2 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  {step.title}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="features" className="border-y border-border/60 bg-secondary/20">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14 text-center">
            <h2 className="font-display text-3xl tracking-tight">Built for engineering-led QA</h2>
            <p className="mt-3 text-muted-foreground">
              Every screen is designed for a team that ships fast and can't scale manual testing.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border/60 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <h2 className="font-display text-3xl tracking-tight">Usage-based pricing</h2>
          <p className="mt-3 text-muted-foreground">
            Pay for what you run, not how many seats you have.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted
                  ? "relative border-primary/50 bg-card shadow-glow"
                  : "border-border/60 bg-card/60"
              }
            >
              {tier.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{tier.price}</span>
                  {tier.price !== "Custom" && <span className="text-sm text-muted-foreground">/mo</span>}
                </div>
                <CardDescription>{tier.cadence}</CardDescription>
                <p className="pt-2 text-sm text-muted-foreground">{tier.description}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="space-y-2 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-2"
                  variant={tier.highlighted ? "default" : "outline"}
                  asChild
                >
                  <Link to="/signup">{tier.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-secondary/20">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            Trusted by engineering teams at
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-muted-foreground/70">
            {["Northwind", "Orbit", "Ledgerly", "Atlas Labs", "Vantage"].map((name) => (
              <span key={name} className="text-lg font-semibold tracking-tight">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 border-t border-border/60 pt-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <WayamMark className="h-9 w-9" />
            <span className="font-display text-sm">Parikshan</span>
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5 text-muted-foreground">
            <Github className="h-4 w-4" />
            <Slack className="h-4 w-4" />
          </div>
        </div>
      </footer>
    </div>
  );
}
