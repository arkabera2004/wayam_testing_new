/**
 * Seeds the tables behind Code Review, Doc Tests, Test Selection, PRD and API
 * keys. Content mirrors what those screens used to hardcode, so the pages look
 * the same — the difference is that it now lives in Postgres and the coverage
 * numbers are derived from the real suite rather than typed in.
 */
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "@/db/index";

const USER = process.env.SEED_USER_ID ?? "demo-user";

async function main() {
  const db = getDb();

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, USER), eq(schema.projects.name, "ShopStack")))
    .limit(1);

  if (!project) throw new Error(`No ShopStack project for user ${USER}. Run db:seed first.`);
  const projectId = project.id;
  console.log(`Seeding screens for ${project.name} (${projectId})`);

  /* ---- Code review ---- */
  await db.delete(schema.codeReviews).where(eq(schema.codeReviews.projectId, projectId));
  const [review] = await db
    .insert(schema.codeReviews)
    .values({
      projectId,
      sha: "a1b2c3d",
      message: "Rename pay button and tighten checkout validation",
      author: "Aarav Mehta",
      recommendation: "REQUEST_CHANGES",
      summary:
        "The rename is safe, but the new validation path lets an expired card through to the order endpoint and the added query runs inside a loop.",
      securityFlags: [
        "Card expiry is validated client-side only; /api/orders accepts an expired card.",
        "Login route logs the full request body, including the password field.",
      ],
    })
    .returning();

  await db.insert(schema.codeReviewComments).values([
    {
      reviewId: review.id,
      file: "src/checkout/pay.tsx",
      line: 84,
      severity: "critical",
      category: "security",
      title: "Expiry check never reaches the server",
      body: "`validateCard` runs in the browser and its result is discarded before the POST. A crafted request can submit an expired card and the order is created.",
      suggestion: "Re-validate expiry inside the /api/orders handler before writing the order.",
    },
    {
      reviewId: review.id,
      file: "src/api/auth/login.ts",
      line: 31,
      severity: "critical",
      category: "security",
      title: "Password logged in plain text",
      body: "The whole request body is written to the log line, so passwords land in log storage.",
      suggestion: "Log the email and a request id, never the body.",
    },
    {
      reviewId: review.id,
      file: "src/cart/totals.ts",
      line: 52,
      severity: "high",
      category: "performance",
      title: "Query inside a loop",
      body: "Each cart line triggers its own lookup, so a ten-line cart makes ten round trips.",
      suggestion: "Fetch the products once by id and join in memory.",
    },
  ]);

  /* ---- Doc tests ---- */
  await db.delete(schema.docSources).where(eq(schema.docSources.projectId, projectId));
  const [doc] = await db
    .insert(schema.docSources)
    .values({ projectId, name: "checkout-spec-v3.md", sizeBytes: 18_432, sections: 7 })
    .returning();

  await db.insert(schema.docScenarios).values([
    { docId: doc.id, title: "Express checkout completes in under three taps", expectation: "Order is created and the confirmation shows the order id.", source: "§2.1 Express checkout", tag: "happy-path", selected: true },
    { docId: doc.id, title: "Saved card with no saved address falls back to the address form", expectation: "The address form appears pre-filled with the billing address.", source: "§2.4 Fallbacks", tag: "edge-case", selected: true },
    { docId: doc.id, title: "Expired saved card is rejected before order creation", expectation: "A decline message is shown and no order is written.", source: "§3.2 Card validation", tag: "negative", selected: true },
    { docId: doc.id, title: "Declined payment leaves the cart intact", expectation: "The cart still holds every line item after a decline.", source: "§3.3 Failure handling", tag: "negative", selected: true },
    { docId: doc.id, title: "Checkout is reachable from the cart badge", expectation: "The badge links straight to /checkout.", source: "§1.2 Entry points", tag: "happy-path", selected: false },
  ]);

  /* ---- Test selection ---- */
  await db.delete(schema.testSelections).where(eq(schema.testSelections.projectId, projectId));
  await db.insert(schema.testSelections).values({
    projectId,
    oldSha: "9f2c1ab",
    newSha: "a1b2c3d",
    changedFiles: ["src/checkout/pay.tsx", "src/cart/totals.ts", "src/api/auth/login.ts"],
  });

  /* ---- PRD + requirements ---- */
  await db.delete(schema.prdDocuments).where(eq(schema.prdDocuments.projectId, projectId));
  const [prd] = await db
    .insert(schema.prdDocuments)
    .values({
      projectId,
      name: "Checkout v3 PRD",
      status: "analyzed",
      sizeBytes: 24_100,
      sections: 6,
      body: "Express checkout, saved cards, and failure handling for the ShopStack storefront.",
    })
    .returning();

  const reqs: Array<{
    title: string;
    body: string;
    kind: (typeof schema.REQUIREMENT_KIND)[number];
    priority: (typeof schema.REQUIREMENT_PRIORITY)[number];
    ambiguity?: string;
  }> = [
    { title: "Express checkout in three taps", body: "A returning customer with a saved card and address completes checkout in no more than three taps.", kind: "functional", priority: "P0" },
    { title: "Expired cards are rejected server-side", body: "An expired card is refused before an order row is written.", kind: "security", priority: "P0" },
    { title: "Declined payment preserves the cart", body: "After a decline the cart still holds every line item.", kind: "functional", priority: "P0" },
    { title: "Address fallback", body: "A saved card with no saved address falls back to the address form.", kind: "functional", priority: "P1" },
    { title: "Checkout reachable from the cart badge", body: "The cart badge links directly to checkout.", kind: "functional", priority: "P2" },
    { title: "Checkout completes within two seconds", body: "Checkout should feel fast.", kind: "non-functional", priority: "P1", ambiguity: "\"Fast\" is not a threshold. Needs a percentile and a budget, e.g. p95 under 2s." },
    { title: "Payment form is keyboard navigable", body: "Every control in the payment form is reachable and operable by keyboard.", kind: "accessibility", priority: "P1" },
    { title: "Errors are user friendly", body: "Payment errors should be clear.", kind: "non-functional", priority: "P2", ambiguity: "No definition of clear, and no list of the error states to cover." },
  ];

  await db.delete(schema.requirements).where(eq(schema.requirements.projectId, projectId));
  await db.insert(schema.requirements).values(
    reqs.map((r) => ({
      projectId,
      prdId: prd.id,
      title: r.title,
      body: r.body,
      kind: r.kind,
      priority: r.priority,
      ambiguity: r.ambiguity ?? null,
      source: "prd" as const,
    })),
  );

  // Link the existing suites to requirements so PRD coverage is derived from
  // the real suite rather than stored as a number.
  const inserted = await db.select().from(schema.requirements).where(eq(schema.requirements.prdId, prd.id));
  const suites = await db.select().from(schema.testSuites).where(eq(schema.testSuites.projectId, projectId));
  for (let i = 0; i < suites.length && i < inserted.length; i++) {
    await db
      .update(schema.testSuites)
      .set({ requirementId: inserted[i].id })
      .where(eq(schema.testSuites.id, suites[i].id));
  }

  console.log(
    `Done: 1 review + 3 comments, 1 document + 5 scenarios, 1 selection, 1 PRD + ${reqs.length} requirements, ${Math.min(suites.length, inserted.length)} suites linked.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
