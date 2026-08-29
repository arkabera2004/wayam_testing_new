#!/usr/bin/env node
// Populates an existing org with realistic demo data across every domain
// collection — projects, scenarios, test cases, runs/results (including a
// couple of intentionally flaky ones), plus a sampling of the newer
// Testing & Quality modules (test selection, doc tests, synthetic data)
// and a connected integration or two. Every document is real, inserted
// through the same collections the app reads from — this fills the
// dashboard/analytics/new-module pages with plausible activity for a demo
// or screenshot, it doesn't fake anything at the UI layer.
//
// Safe to re-run: each run inserts a fresh, separately-named batch of
// projects rather than upserting, so re-running just adds more history
// (handy for restocking a demo trend chart). Delete via the org's
// Projects page if you want to start clean.
//
//   node --env-file=.env scripts/seed-demo.mjs --email=you@example.com
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "parikshan";

if (!uri) {
  console.error("Missing MONGODB_URI. Pass it via --env-file=.env or export it directly.");
  process.exit(1);
}

const emailArg = process.argv.find((a) => a.startsWith("--email="));
const email = emailArg ? emailArg.slice("--email=".length).toLowerCase().trim() : null;
if (!email) {
  console.error("Usage: node --env-file=.env scripts/seed-demo.mjs --email=you@example.com");
  process.exit(1);
}

const client = new MongoClient(uri);

function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SCENARIO_LIBRARY = [
  {
    type: "E2E",
    title: "Checkout completes with a saved card",
    priority: "critical",
    filePath: "tests/e2e/checkout-saved-card.spec.ts",
  },
  {
    type: "E2E",
    title: "New user signup reaches the welcome screen",
    priority: "critical",
    filePath: "tests/e2e/signup-welcome.spec.ts",
  },
  {
    type: "API",
    title: "POST /orders rejects a negative quantity",
    priority: "high",
    filePath: "tests/api/orders-validation.spec.ts",
  },
  {
    type: "API",
    title: "GET /users/:id returns 404 for an unknown id",
    priority: "medium",
    filePath: "tests/api/users-404.spec.ts",
  },
  {
    type: "Regression",
    title: "Discount codes stack correctly with membership pricing",
    priority: "high",
    filePath: "tests/regression/discount-stacking.spec.ts",
  },
  {
    type: "Accessibility",
    title: "Checkout form is fully keyboard navigable",
    priority: "medium",
    filePath: "tests/a11y/checkout-keyboard.spec.ts",
  },
  {
    type: "Visual",
    title: "Pricing page holds layout at tablet width",
    priority: "low",
    filePath: "tests/visual/pricing-tablet.spec.ts",
  },
  {
    type: "API",
    title: "Webhook delivery retries on a 5xx from the receiver",
    priority: "high",
    filePath: "tests/api/webhook-retry.spec.ts",
  },
];

const DEMO_PROJECTS = [
  { name: "checkout-service", sourceType: "github", sourceUrl: "github.com/acme/checkout-service" },
  { name: "billing-api", sourceType: "github", sourceUrl: "github.com/acme/billing-api" },
  { name: "marketing-site", sourceType: "url", sourceUrl: "https://acme.example.com" },
  { name: "mobile-gateway", sourceType: "github", sourceUrl: "github.com/acme/mobile-gateway" },
];

async function seedProject(db, orgId, def, index) {
  const { projects, testPlans, testScenarios, testCases, testRuns, runResults } = {
    projects: db.collection("projects"),
    testPlans: db.collection("test_plans"),
    testScenarios: db.collection("test_scenarios"),
    testCases: db.collection("test_cases"),
    testRuns: db.collection("test_runs"),
    runResults: db.collection("run_results"),
  };

  const now = new Date();
  const projectId = new ObjectId();
  await projects.insertOne({
    _id: projectId,
    orgId,
    name: def.name,
    sourceType: def.sourceType,
    sourceUrl: def.sourceUrl,
    createdAt: daysAgo(10 + index),
    updatedAt: now,
  });

  const testPlanId = new ObjectId();
  await testPlans.insertOne({
    _id: testPlanId,
    orgId,
    projectId,
    createdAt: daysAgo(10 + index),
    updatedAt: now,
  });

  // Every project gets the full scenario library, shuffled into
  // accepted/proposed/rejected so the review UI, coverage %, and risk
  // scoring all have something real to show.
  const scenarioDocs = SCENARIO_LIBRARY.map((s) => {
    const roll = Math.random();
    const status = roll < 0.65 ? "accepted" : roll < 0.85 ? "proposed" : "rejected";
    return {
      _id: new ObjectId(),
      orgId,
      testPlanId,
      type: s.type,
      title: s.title,
      description: `Auto-seeded demo scenario for ${def.name}: ${s.title.toLowerCase()}.`,
      status,
      priority: s.priority,
      filePath: s.filePath,
      createdAt: daysAgo(9 + index),
      updatedAt: daysAgo(Math.floor(Math.random() * 5)),
    };
  });
  await testScenarios.insertMany(scenarioDocs);

  const acceptedScenarios = scenarioDocs.filter((s) => s.status === "accepted");
  const caseDocs = acceptedScenarios.map((scenario) => ({
    _id: new ObjectId(),
    orgId,
    scenarioId: scenario._id,
    generatedCode:
      scenario.type === "API"
        ? `// ${scenario.title}\nconst res = await fetch(\`\${BASE_URL}/v1/resource\`);\nexpect(res.status).toBeLessThan(400);`
        : `import { test, expect } from '@playwright/test';\n\ntest('${scenario.title}', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.getByRole('heading')).toBeVisible();\n});`,
    language: "typescript",
    framework: scenario.type === "API" ? "http" : "playwright",
    status: "not_run",
    quarantined: false,
    quarantinedAt: null,
    createdAt: scenario.createdAt,
    updatedAt: scenario.createdAt,
  }));
  if (caseDocs.length > 0) await testCases.insertMany(caseDocs);

  // Spread ~2 runs/day over the last 7 days so the trend chart has a real
  // shape. One case is deliberately made flaky (alternating pass/fail)
  // so the flaky-test leaderboard and Release Gate both have something
  // to report.
  const flakyCaseId = caseDocs.length > 0 ? caseDocs[0]._id : null;
  for (let day = 6; day >= 0; day--) {
    const runsThisDay = Math.random() < 0.7 ? 1 : 2;
    for (let r = 0; r < runsThisDay; r++) {
      const startedAt = daysAgo(day, 9 + r * 4);
      const runId = new ObjectId();
      const results = caseDocs.map((c, i) => {
        let status = Math.random() < 0.82 ? "passed" : "failed";
        const isFlakyCase = flakyCaseId && c._id.equals(flakyCaseId);
        if (isFlakyCase) {
          status = (day + r) % 2 === 0 ? "passed" : "failed";
        }
        // Give the flaky case's very last failure a heal suggestion, so
        // /self-healing has something real to show.
        const givesHealSuggestion =
          isFlakyCase && status === "failed" && day === 0 && r === runsThisDay - 1;
        return {
          _id: new ObjectId(),
          orgId,
          runId,
          testCaseId: c._id,
          status,
          durationMs: 800 + Math.floor(Math.random() * 4000),
          errorMessage:
            status === "failed"
              ? "Error: expected element to be visible within 5000ms — locator resolved to 0 elements."
              : null,
          createdAt: new Date(startedAt.getTime() + i * 1500),
          healedSelector: givesHealSuggestion
            ? "getByRole('button', { name: 'Place order' })"
            : null,
          healNote: givesHealSuggestion
            ? "[high confidence] The element's accessible name changed; position and class list are unchanged."
            : null,
          healApplied: false,
        };
      });
      const failed = results.filter((r2) => r2.status === "failed").length;
      const overallStatus =
        results.length === 0
          ? "passed"
          : failed === 0
            ? "passed"
            : failed === results.length
              ? "failed"
              : "flaky";
      const finishedAt = new Date(startedAt.getTime() + results.length * 1500 + 2000);

      await testRuns.insertOne({
        _id: runId,
        orgId,
        projectId,
        trigger: pick(["manual", "on_pr", "scheduled"]),
        status: overallStatus,
        startedAt,
        finishedAt,
      });
      if (results.length > 0) await runResults.insertMany(results);

      await Promise.all(
        results.map((r2) =>
          testCases.updateOne(
            { _id: r2.testCaseId },
            {
              $set: {
                status: r2.status === "passed" ? "passing" : "failing",
                updatedAt: finishedAt,
              },
            },
          ),
        ),
      );
    }
  }

  return { projectId, testPlanId, scenarioDocs, caseDocs };
}

async function main() {
  await client.connect();
  const db = client.db(dbName);

  const user = await db.collection("users").findOne({ email });
  if (!user) {
    console.error(`No user found with email "${email}". Sign up (or use the demo login) first.`);
    process.exitCode = 1;
    return;
  }
  const membership = await db.collection("organization_members").findOne({ userId: user._id });
  if (!membership) {
    console.error(
      `User "${email}" isn't a member of any organization yet — finish onboarding first.`,
    );
    process.exitCode = 1;
    return;
  }
  const orgId = membership.orgId;

  console.log(`Seeding demo data into org ${orgId} (user: ${email})...`);

  const seeded = [];
  for (let i = 0; i < DEMO_PROJECTS.length; i++) {
    const result = await seedProject(db, orgId, DEMO_PROJECTS[i], i);
    seeded.push({ ...DEMO_PROJECTS[i], ...result });
    console.log(
      `  + project "${DEMO_PROJECTS[i].name}" — ${result.scenarioDocs.length} scenarios, ${result.caseDocs.length} test cases`,
    );
  }

  // A sampling of the newer modules, so their pages aren't empty either.
  const first = seeded[0];
  const acceptedFirst = first.scenarioDocs.filter((s) => s.status === "accepted");
  if (acceptedFirst.length > 0) {
    await db.collection("test_selection_runs").insertOne({
      _id: new ObjectId(),
      orgId,
      projectId: first.projectId,
      changedFiles: ["src/checkout.ts", "src/lib/pricing.ts"],
      diffAvailable: true,
      totalTests: acceptedFirst.length,
      selectedTests: Math.max(1, Math.floor(acceptedFirst.length / 2)),
      skippedTests: Math.ceil(acceptedFirst.length / 2),
      estimatedSavingsPct: 45,
      candidates: acceptedFirst.map((s, i) => ({
        testCaseId: new ObjectId(),
        scenarioTitle: s.title,
        scenarioType: s.type,
        filePath: s.filePath,
        priority: s.priority,
        score: i === 0 ? 5 : 0,
        selected: i === 0,
        reasons: [
          {
            label:
              i === 0
                ? 'Test file matches changed file "src/checkout.ts"'
                : "No overlap with changed files",
            matched: i === 0,
          },
        ],
      })),
      createdAt: daysAgo(1),
    });
    console.log("  + 1 test_selection_runs sample");

    await db.collection("doc_test_runs").insertOne({
      _id: new ObjectId(),
      orgId,
      projectId: first.projectId,
      docTitle: "Checkout API — refund policy",
      docExcerpt:
        "Refunds must be issued within 30 days of purchase. A refund request after 30 days should return a 422 with a machine-readable error code.",
      scenarios: [
        {
          title: "Refund request after 30 days returns 422",
          description:
            'Documented requirement: "A refund request after 30 days should return a 422 with a machine-readable error code."',
          type: "API",
          priority: "medium",
          filePath: "tests/api/refund-window.spec.ts",
        },
      ],
      source: "heuristic",
      createdAt: daysAgo(2),
    });
    console.log("  + 1 doc_test_runs sample");

    await db.collection("synthetic_data_runs").insertOne({
      _id: new ObjectId(),
      orgId,
      scenarioId: acceptedFirst[0]._id,
      scenarioTitle: acceptedFirst[0].title,
      count: 3,
      records: [
        { email: "test.user1@example.com", amount: 49.99 },
        { email: "test.user2@example.com", amount: 129.5 },
        { email: "test.user3@example.com", amount: 9.99 },
      ],
      source: "heuristic",
      createdAt: daysAgo(1),
    });
    console.log("  + 1 synthetic_data_runs sample");
  }

  // Connect GitHub (with a config flag), leave Slack/Jira as-is so the
  // Integrations page shows a realistic mixed state rather than "all
  // connected."
  await db.collection("integrations").updateOne(
    { orgId, provider: "github" },
    {
      $set: { status: "connected", config: { runOnEveryPr: true }, updatedAt: new Date() },
      $setOnInsert: { _id: new ObjectId(), orgId, provider: "github", createdAt: new Date() },
    },
    { upsert: true },
  );
  console.log("  + GitHub integration connected");

  console.log(`\nDone. ${seeded.length} demo projects seeded into org ${orgId}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
