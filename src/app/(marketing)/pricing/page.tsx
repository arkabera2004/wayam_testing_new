import Link from "next/link";
import { Check } from "lucide-react";

import { Button, Card, Chip, cn } from "@/components/ui";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "500 test-minutes a month, one project, community support.",
    features: ["500 test-minutes / month", "1 project", "Playwright export", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Usage",
    price: "$0.04",
    cadence: "per test-minute",
    blurb: "Pay for what you run. Unlimited seats, always.",
    features: [
      "Unlimited projects",
      "Unlimited seats",
      "Cloud parallel runs",
      "Email support",
    ],
    cta: "Start with usage",
    featured: true,
  },
  {
    name: "Growth",
    price: "$249",
    cadence: "per month + usage",
    blurb: "Self-healing, visual and accessibility modules, team workflow.",
    features: [
      "Everything in Usage",
      "Self-healing locators",
      "Visual + a11y modules",
      "Slack and Jira",
      "Flaky quarantine",
    ],
    cta: "Choose Growth",
    featured: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    blurb: "SSO, private grid, compliance packs and an SLA.",
    features: [
      "Everything in Growth",
      "SSO / SAML",
      "On-prem or private grid",
      "Compliance packs",
      "99.9% SLA",
    ],
    cta: "Talk to us",
    featured: false,
  },
];

const FAQS = [
  {
    q: "What counts as a test-minute?",
    a: "Wall-clock execution time of a test on a single browser shard, rounded to the nearest second. Queue time is never billed.",
  },
  {
    q: "Do you charge per seat?",
    a: "No. Every plan includes unlimited seats. You pay for execution, so inviting your whole team costs nothing.",
  },
  {
    q: "Do I own the generated code?",
    a: "Yes. Parikshan writes standard Playwright TypeScript into your repository. If you stop paying, the suite still runs.",
  },
  {
    q: "How does self-healing avoid hiding real bugs?",
    a: "Healing only applies to locator resolution, never to assertions. If an assertion fails the test still fails, and every heal is listed for review.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-display-page text-primary text-balance">
          Usage-based, not per-seat.
        </h1>
        <p className="text-body-lg text-secondary mt-4">
          Invite the whole team for free. Pay only for the tests you actually run.
        </p>
      </div>

      <div className="mt-6 inline-flex items-center gap-1 rounded-lg border border-muted bg-container p-1">
        <span className="bg-action-primary text-on-color text-label-md rounded-md px-3 py-1">
          Monthly
        </span>
        <span className="text-label-md text-tertiary px-3 py-1">Annual (save 20%)</span>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "flex flex-col rounded-xl border p-5",
              plan.featured ? "border-active bg-raised" : "border-muted bg-container",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-heading-sm text-primary">{plan.name}</p>
              {plan.featured ? <Chip tone="solid">Popular</Chip> : null}
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-display-sm text-primary tabular">{plan.price}</span>
              <span className="text-body-sm text-tertiary">{plan.cadence}</span>
            </div>

            <p className="text-body-md text-tertiary mt-3">{plan.blurb}</p>

            <ul className="mt-5 flex flex-1 flex-col gap-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={14} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="text-body-md text-secondary">{f}</span>
                </li>
              ))}
            </ul>

            <Link href="/signup" className="mt-6">
              <Button variant={plan.featured ? "primary" : "secondary"} className="w-full">
                {plan.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-16 max-w-3xl">
        <h2 className="text-heading-lg text-primary">Frequently asked</h2>
        <div className="mt-6 flex flex-col gap-3">
          {FAQS.map((faq) => (
            <Card key={faq.q}>
              <p className="text-heading-sm text-primary">{faq.q}</p>
              <p className="text-body-md text-tertiary mt-2">{faq.a}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
