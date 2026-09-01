/**
 * Fills the tables that had no rows: healing events, quarantine, discovery,
 * API inventory, notifications, requirements, risk scores and coverage.
 *
 * Everything is keyed to real projects, cases and runs rather than invented
 * ids, so the screens join correctly and a healing event points at the run
 * that actually exposed it.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-domains.mts
 */
import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "../src/db/index.js";

const db = getDb();
const NAME = process.env.SEED_PROJECT ?? "ShopStack";

const [project] = await db.select().from(schema.projects).where(eq(schema.projects.name, NAME)).limit(1);
if (!project) {
  console.error(`No project named "${NAME}".`);
  process.exit(1);
}

const suites = await db.select().from(schema.testSuites).where(eq(schema.testSuites.projectId, project.id));
const cases = (
  await Promise.all(suites.map((s) => db.select().from(schema.testCases).where(eq(schema.testCases.suiteId, s.id))))
).flat();
const runs = await db
  .select()
  .from(schema.testRuns)
  .where(eq(schema.testRuns.suiteId, suites[0]?.id ?? project.id))
  .orderBy(desc(schema.testRuns.startedAt))
  .limit(5);

const byTitle = (t: string) => cases.find((c) => c.title.toLowerCase().includes(t.toLowerCase()));
const ago = (mins: number) => new Date(Date.now() - mins * 60_000);

/* ---- wipe this project's rows so re-running rebuilds cleanly ---- */
for (const t of [
  schema.healingEvents,
  schema.quarantinedTests,
  schema.discoveredPages,
  schema.apiEndpoints,
  schema.riskScores,
  schema.coverageSnapshots,
  schema.requirements,
] as const) {
  await db.delete(t).where(eq((t as typeof schema.healingEvents).projectId, project.id));
}
await db.delete(schema.notifications).where(eq(schema.notifications.projectId, project.id));

/* ---- healing events ---- */
const healing = [
  { t: "expired card", old: "#pay-btn", nw: "getByRole('button', { name: 'Place order' })", sim: 94, strategy: "dom-similarity", reason: "Matched by DOM similarity, text content and position within the form.", status: "pending" as const, mins: 25, saved: 20 },
  { t: "valid card", old: "#pay-btn", nw: "getByRole('button', { name: 'Place order' })", sim: 94, strategy: "dom-similarity", reason: "Same control as the checkout decline path; healed together.", status: "accepted" as const, mins: 90, saved: 20 },
  { t: "quantity of a cart item", old: ".qty-input", nw: "getByLabel('Quantity for Wireless Mouse')", sim: 88, strategy: "text-match", reason: "The class was removed; the accessible label is stable.", status: "accepted" as const, mins: 260, saved: 15 },
  { t: "newsletter", old: "form > button:nth-child(2)", nw: "getByRole('button', { name: 'Subscribe' })", sim: 71, strategy: "position", reason: "Position-based match; confirm before accepting.", status: "pending" as const, mins: 540, saved: 10 },
  { t: "incorrect password", old: "#login-error", nw: "getByTestId('login-error')", sim: 96, strategy: "dom-similarity", reason: "Element gained a test id; the old id was dropped.", status: "reverted" as const, mins: 1500, saved: 0 },
];
for (const h of healing) {
  await db.insert(schema.healingEvents).values({
    projectId: project.id,
    testCaseId: byTitle(h.t)?.id ?? null,
    runId: runs[0]?.id ?? null,
    oldSelector: h.old,
    newSelector: h.nw,
    strategy: h.strategy,
    similarity: h.sim,
    reason: h.reason,
    status: h.status,
    minutesSaved: h.saved,
    createdAt: ago(h.mins),
    resolvedAt: h.status === "pending" ? null : ago(h.mins - 5),
  });
}

/* ---- quarantine ---- */
const quarantine = [
  { t: "newsletter", reason: "Fails unpredictably on WebKit", pattern: "Fails roughly 1 run in 5, only on WebKit", rate: 19, mins: 240 },
  { t: "empty state", reason: "Depends on search index warm-up", pattern: "Fails when the index is rebuilding", rate: 8, mins: 2880 },
];
for (const q of quarantine) {
  await db.insert(schema.quarantinedTests).values({
    projectId: project.id,
    testCaseId: byTitle(q.t)?.id ?? null,
    reason: q.reason,
    pattern: q.pattern,
    flakyRate: q.rate,
    quarantinedAt: ago(q.mins),
  });
}

/* ---- discovery: pages + endpoints ---- */
const pages = [
  ["/", "Home", 1, 1, false, "High traffic"], ["/products", "Product listing", 1, 2, false, "High traffic"],
  ["/products/:slug", "Product detail", 1, 2, false, "Recently changed"], ["/cart", "Cart", 1, 2, false, "Revenue path"],
  ["/checkout", "Checkout", 2, 3, false, "Revenue path"], ["/login", "Sign in", 1, 1, false, "Auth"],
  ["/signup", "Create account", 1, 1, false, "Auth"], ["/account", "Account overview", 0, 2, true, "Auth"],
  ["/account/settings", "Account settings", 3, 2, true, "Recently changed"], ["/account/orders", "Order history", 0, 1, true, "Low traffic"],
  ["/search", "Search results", 1, 1, false, "High traffic"], ["/support", "Support", 1, 0, false, "Low traffic"],
] as const;
for (const [path, title, forms, apis, gated, risk] of pages) {
  await db.insert(schema.discoveredPages).values({ projectId: project.id, path, title, forms, apis, gated, risk });
}

const endpoints = [
  ["GET", "/api/products", 200, 4], ["POST", "/api/cart", 201, 11], ["POST", "/api/orders", 201, 26],
  ["POST", "/api/auth/login", 200, 31], ["GET", "/api/orders/:id", 200, 38], ["POST", "/api/newsletter", 202, 44],
  ["GET", "/api/user", 200, 52], ["PATCH", "/api/user", 200, 63], ["GET", "/api/search", 200, 72],
] as const;
for (const [method, path, status, sec] of endpoints) {
  await db.insert(schema.apiEndpoints).values({ projectId: project.id, method, path, status, firstSeenSec: sec });
}

/* ---- requirements ---- */
const reqs = [
  ["Express checkout completes in under three taps", "A returning customer with a saved card and address can place an order in three interactions or fewer.", "imported"],
  ["Expired cards are rejected before an order exists", "Card expiry must be validated server-side; no order row may be written for an expired card.", "imported"],
  ["Cart survives navigation", "Cart contents persist across page loads for the duration of the session.", "manual"],
  ["Failed sign-in locks after five attempts", "Five consecutive failures lock the account and show a lockout notice.", "imported"],
] as const;
for (const [title, body, source] of reqs) {
  await db.insert(schema.requirements).values({ projectId: project.id, title, body, source });
}

/* ---- risk scores ---- */
const risks = [
  ["src/checkout/pay.tsx", 48, 92], ["src/api/orders.ts", 36, 81], ["src/cart/totals.ts", 29, 68],
  ["src/api/auth/login.ts", 21, 57], ["src/products/list.tsx", 18, 44], ["src/footer/newsletter.tsx", 12, 31],
  ["src/account/settings.tsx", 6, 18], ["src/support/faq.tsx", 3, 9],
] as const;
for (const [filePath, churn, composite] of risks) {
  await db.insert(schema.riskScores).values({
    projectId: project.id,
    filePath,
    changeFrequencyScore: String(churn),
    complexityScore: String(Math.round(composite * 0.7)),
    compositeRiskScore: String(composite),
  });
}

/* ---- coverage ---- */
for (const [path, , , , ,] of pages) {
  const covered = !["/support", "/account/orders"].includes(path);
  await db.insert(schema.coverageSnapshots).values({
    projectId: project.id,
    runId: runs[0]?.id ?? null,
    filePath: path,
    isCovered: covered,
    mappedTestCaseIds: covered ? cases.slice(0, 2).map((c) => c.id) : [],
    estimatedConfidence: covered ? "high" : "low",
  });
}

/* ---- notifications ---- */
const notes = [
  ["failed", "Run failed", "1 of 10 tests failed on Chromium.", 3, null],
  ["healing", "Locator healed automatically", "'#pay-btn' is now 'Place order' across 2 tests.", 25, null],
  ["quarantine", "Test quarantined", "Newsletter signup fails 1 in 5 on WebKit.", 240, null],
  ["passed", "Quality gate passed", "10 of 10 tests passed.", 540, 500],
  ["passed", "Scheduled run completed", "Run finished in 6.5s.", 1500, 1400],
] as const;
for (const [type, title, body, mins, readMins] of notes) {
  await db.insert(schema.notifications).values({
    projectId: project.id,
    type,
    title,
    body,
    createdAt: ago(mins),
    readAt: readMins ? ago(readMins) : null,
  });
}

console.log(`seeded for ${project.name}`);
console.log(`  healing ${healing.length} · quarantine ${quarantine.length} · pages ${pages.length}`);
console.log(`  endpoints ${endpoints.length} · requirements ${reqs.length} · risk ${risks.length}`);
console.log(`  coverage ${pages.length} · notifications ${notes.length}`);
