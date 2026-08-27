/**
 * Seed data for Parikshan v1.
 *
 * INTEGRATION POINT: these shapes mirror the planned Lovable Cloud tables
 * (organizations, projects, test_plans, test_scenarios, test_cases,
 * test_runs, run_results, integrations). Swap these readers for typed
 * database queries without changing any component below.
 */

export type ScenarioType = "E2E" | "API" | "Regression" | "Accessibility" | "Visual";
export type ScenarioStatus = "proposed" | "accepted" | "rejected";
export type Priority = "critical" | "high" | "medium" | "low";
export type RunStatus = "passed" | "failed" | "running" | "flaky";

export interface Project {
  id: string;
  name: string;
  sourceType: "github" | "url";
  sourceUrl: string;
  lastRunStatus: RunStatus;
  coverage: number;
  updatedAt: string;
  testCount: number;
}

export interface Scenario {
  id: string;
  projectId: string;
  type: ScenarioType;
  title: string;
  description: string;
  priority: Priority;
  status: ScenarioStatus;
  filePath: string;
  caseStatus: "passing" | "failing" | "flaky" | "not_run";
  code: string;
}

export interface Run {
  id: string;
  projectId: string;
  trigger: "manual" | "on_pr" | "scheduled";
  status: RunStatus;
  durationMs: number;
  passed: number;
  failed: number;
  startedAt: string;
}

export const projects: Project[] = [
  {
    id: "atlas",
    name: "Atlas Checkout",
    sourceType: "github",
    sourceUrl: "github.com/northwind/atlas-checkout",
    lastRunStatus: "passed",
    coverage: 82,
    updatedAt: "2026-08-26T10:12:00Z",
    testCount: 148,
  },
  {
    id: "orbit",
    name: "Orbit Admin",
    sourceType: "url",
    sourceUrl: "https://app.orbit.io",
    lastRunStatus: "failed",
    coverage: 61,
    updatedAt: "2026-08-25T16:40:00Z",
    testCount: 93,
  },
  {
    id: "ledgerly",
    name: "Ledgerly API",
    sourceType: "github",
    sourceUrl: "github.com/northwind/ledgerly-api",
    lastRunStatus: "flaky",
    coverage: 74,
    updatedAt: "2026-08-24T08:05:00Z",
    testCount: 61,
  },
];

const playwrightCode = (title: string) => `import { test, expect } from '@playwright/test';

test('${title}', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill('qa@parikshan.dev');
  await page.getByLabel('Password').fill(process.env.QA_PASSWORD!);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});`;

const apiCode = (title: string) => `// ${title}
const res = await fetch(\`\${BASE_URL}/v1/invoices\`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: \`Bearer \${TOKEN}\` },
  body: JSON.stringify({ amount_cents: 4200, currency: 'usd' }),
});

expect(res.status).toBe(201);
const body = await res.json();
expect(body.id).toMatch(/^inv_/);
expect(body.amount_cents).toBe(4200);`;

export const scenarios: Scenario[] = [
  {
    id: "sc-1",
    projectId: "atlas",
    type: "E2E",
    title: "Guest completes checkout with a saved card",
    description:
      "A signed-out visitor adds two items to the cart, enters shipping details, pays with a stored test card, and lands on the order confirmation page with a valid order number.",
    priority: "critical",
    status: "accepted",
    filePath: "tests/e2e/checkout-guest.spec.ts",
    caseStatus: "passing",
    code: playwrightCode("guest completes checkout"),
  },
  {
    id: "sc-2",
    projectId: "atlas",
    type: "E2E",
    title: "Expired card shows an inline recoverable error",
    description:
      "When payment fails with an expired card, the user stays on the payment step, sees a clear inline error, and the cart contents are preserved.",
    priority: "high",
    status: "proposed",
    filePath: "tests/e2e/checkout-expired-card.spec.ts",
    caseStatus: "not_run",
    code: playwrightCode("expired card shows inline error"),
  },
  {
    id: "sc-3",
    projectId: "atlas",
    type: "API",
    title: "Invoice creation rejects negative amounts",
    description:
      "POST /v1/invoices with a negative amount returns 422 and a machine-readable error code rather than creating a record.",
    priority: "high",
    status: "accepted",
    filePath: "tests/api/invoices.create.spec.ts",
    caseStatus: "failing",
    code: apiCode("invoice creation rejects negative amounts"),
  },
  {
    id: "sc-4",
    projectId: "atlas",
    type: "Regression",
    title: "Promo code stacking stays disabled",
    description:
      "Regression guard for INC-412: applying a second promo code must replace the first, never stack discounts.",
    priority: "medium",
    status: "accepted",
    filePath: "tests/regression/promo-stacking.spec.ts",
    caseStatus: "flaky",
    code: playwrightCode("promo code stacking stays disabled"),
  },
  {
    id: "sc-5",
    projectId: "atlas",
    type: "Accessibility",
    title: "Checkout form is fully keyboard navigable",
    description:
      "Every field, error and the pay button are reachable by keyboard with visible focus, and errors are announced to screen readers.",
    priority: "medium",
    status: "proposed",
    filePath: "tests/a11y/checkout-keyboard.spec.ts",
    caseStatus: "not_run",
    code: playwrightCode("checkout form is keyboard navigable"),
  },
  {
    id: "sc-6",
    projectId: "atlas",
    type: "Visual",
    title: "Cart summary layout holds at tablet width",
    description:
      "Snapshot of the cart summary at 834px wide must not shift more than 0.1% between runs.",
    priority: "low",
    status: "proposed",
    filePath: "tests/visual/cart-summary.spec.ts",
    caseStatus: "not_run",
    code: playwrightCode("cart summary layout at tablet width"),
  },
  {
    id: "sc-7",
    projectId: "orbit",
    type: "E2E",
    title: "Admin invites a teammate and assigns a role",
    description:
      "An org admin sends an invite, the pending member appears in the members table, and the role selector persists after reload.",
    priority: "critical",
    status: "accepted",
    filePath: "tests/e2e/invite-teammate.spec.ts",
    caseStatus: "failing",
    code: playwrightCode("admin invites a teammate"),
  },
  {
    id: "sc-8",
    projectId: "ledgerly",
    type: "API",
    title: "Rate limit returns 429 with retry-after",
    description:
      "The 61st request inside a minute is rejected with 429 and a Retry-After header in seconds.",
    priority: "high",
    status: "accepted",
    filePath: "tests/api/rate-limit.spec.ts",
    caseStatus: "passing",
    code: apiCode("rate limit returns 429"),
  },
];

export const runs: Run[] = [
  {
    id: "run_8f21",
    projectId: "atlas",
    trigger: "on_pr",
    status: "failed",
    durationMs: 214000,
    passed: 141,
    failed: 7,
    startedAt: "2026-08-26T10:12:00Z",
  },
  {
    id: "run_8e04",
    projectId: "atlas",
    trigger: "scheduled",
    status: "passed",
    durationMs: 198000,
    passed: 148,
    failed: 0,
    startedAt: "2026-08-25T02:00:00Z",
  },
  {
    id: "run_8d77",
    projectId: "orbit",
    trigger: "manual",
    status: "flaky",
    durationMs: 132000,
    passed: 89,
    failed: 4,
    startedAt: "2026-08-24T14:22:00Z",
  },
  {
    id: "run_8c19",
    projectId: "ledgerly",
    trigger: "on_pr",
    status: "passed",
    durationMs: 61000,
    passed: 61,
    failed: 0,
    startedAt: "2026-08-23T09:41:00Z",
  },
];

export const trend = [
  { day: "Aug 20", passed: 128, failed: 12 },
  { day: "Aug 21", passed: 134, failed: 9 },
  { day: "Aug 22", passed: 139, failed: 6 },
  { day: "Aug 23", passed: 142, failed: 8 },
  { day: "Aug 24", passed: 137, failed: 11 },
  { day: "Aug 25", passed: 148, failed: 0 },
  { day: "Aug 26", passed: 141, failed: 7 },
];

export const coverageByArea = [
  { area: "Checkout", coverage: 91, risk: 12 },
  { area: "Auth", coverage: 84, risk: 18 },
  { area: "Billing", coverage: 66, risk: 47 },
  { area: "Admin", coverage: 58, risk: 61 },
  { area: "Search", coverage: 73, risk: 29 },
  { area: "Notifications", coverage: 41, risk: 72 },
];

export const flakyTests = [
  { name: "promo code stacking stays disabled", project: "Atlas Checkout", flips: 6, rate: 43 },
  { name: "admin invites a teammate", project: "Orbit Admin", flips: 4, rate: 31 },
  { name: "webhook retry backoff", project: "Ledgerly API", flips: 3, rate: 22 },
];

export const integrations = [
  {
    id: "github",
    name: "GitHub",
    blurb: "Connect a repository and run the suite on every pull request.",
    connected: true,
    detail: "northwind/atlas-checkout",
  },
  {
    id: "slack",
    name: "Slack",
    blurb: "Post a message to a channel whenever a run fails.",
    connected: false,
    detail: "Not yet connected",
  },
  {
    id: "jira",
    name: "Jira",
    blurb: "Automatically file a bug ticket for each new failing test.",
    connected: false,
    detail: "Not yet connected",
  },
];

export const members = [
  { name: "Aditi Rao", email: "aditi@northwind.dev", role: "Admin" },
  { name: "Marco Silva", email: "marco@northwind.dev", role: "Editor" },
  { name: "Jen Okafor", email: "jen@northwind.dev", role: "Viewer" },
];

export const getProject = (id: string) => projects.find((p) => p.id === id);
export const scenariosFor = (projectId: string) =>
  scenarios.filter((s) => s.projectId === projectId);
export const runsFor = (projectId: string) => runs.filter((r) => r.projectId === projectId);
