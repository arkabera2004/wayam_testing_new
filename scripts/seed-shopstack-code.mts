/**
 * Attaches executable Playwright code to the ShopStack test cases.
 *
 * The cases described real cart, checkout, auth and search behaviour but had
 * no code and pointed at shopstack.demo, which does not resolve. They now run
 * against the storefront served at /demo/shopstack, so each scenario passes or
 * fails on actual behaviour.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-shopstack-code.mts
 */
import { eq } from "drizzle-orm";

import { getDb, schema } from "../src/db/index.js";

const db = getDb();
const SHOP = '"/demo/shopstack"';

/** Keyed by test case title; each body is the inside of a Playwright test. */
const BODIES: Record<string, string[]> = {
  "User updates the quantity of a cart item": [
    'await page.goto(BASE + SHOP);',
    'await page.getByRole("listitem").filter({ hasText: "Wireless Mouse" }).getByRole("button", { name: "Add to cart" }).click();',
    'await page.goto(BASE + SHOP + "/cart");',
    'await page.getByLabel("Quantity for Wireless Mouse").fill("3");',
    'await expect(page.getByTestId("line-total-wireless-mouse")).toHaveText("$72.00");',
    'await expect(page.getByTestId("cart-total")).toHaveText("$72.00");',
  ],
  "User removes the last item from the cart": [
    'await page.goto(BASE + SHOP);',
    'await page.getByRole("listitem").filter({ hasText: "USB-C Hub" }).getByRole("button", { name: "Add to cart" }).click();',
    'await page.goto(BASE + SHOP + "/cart");',
    'await page.getByRole("button", { name: "Remove" }).click();',
    'await expect(page.getByTestId("cart-empty")).toBeVisible();',
    'await expect(page.getByTestId("cart-badge")).toHaveText("0");',
  ],
  "Checkout is blocked when the cart is empty": [
    'await page.goto(BASE + SHOP + "/checkout");',
    'await expect(page).toHaveURL(/\\/cart$/);',
    'await expect(page.getByTestId("cart-empty")).toBeVisible();',
  ],
  "User completes checkout with a valid card": [
    'await page.goto(BASE + SHOP);',
    'await page.getByRole("listitem").filter({ hasText: "Wireless Mouse" }).getByRole("button", { name: "Add to cart" }).click();',
    'await page.goto(BASE + SHOP + "/checkout");',
    'await page.getByLabel("Card number").fill("4242424242424242");',
    'await page.getByLabel("Expiry").fill("01/30");',
    'await page.getByRole("button", { name: "Place order" }).click();',
    'await expect(page.getByTestId("order-number")).toBeVisible();',
  ],
  "User checks out with an expired card": [
    'await page.goto(BASE + SHOP);',
    'await page.getByRole("listitem").filter({ hasText: "Wireless Mouse" }).getByRole("button", { name: "Add to cart" }).click();',
    'await page.goto(BASE + SHOP + "/checkout");',
    'await page.getByLabel("Card number").fill("4242424242424242");',
    'await page.getByLabel("Expiry").fill("01/24");',
    'await page.getByRole("button", { name: "Place order" }).click();',
    'await expect(page.getByTestId("decline-message")).toBeVisible();',
    'await expect(page.getByTestId("order-number")).toHaveCount(0);',
  ],
  "Login fails with an incorrect password": [
    'await page.goto(BASE + SHOP + "/login");',
    'await page.getByLabel("Email").fill("demo@shopstack.demo");',
    'await page.getByLabel("Password").fill("definitely-wrong");',
    'await page.getByRole("button", { name: "Sign in" }).click();',
    'await expect(page.getByTestId("login-error")).toHaveText("Incorrect email or password.");',
    'await expect(page.getByTestId("signed-in")).toHaveCount(0);',
  ],
  "Account locks after five failed attempts": [
    'await page.goto(BASE + SHOP + "/login");',
    'await page.getByLabel("Email").fill("demo@shopstack.demo");',
    'for (let i = 0; i < 5; i++) {',
    '    await page.getByLabel("Password").fill("wrong-" + i);',
    '    await page.getByRole("button", { name: "Sign in" }).click();',
    '  }',
    'await expect(page.getByTestId("login-error")).toContainText("locked");',
  ],
  "Sign up is rejected for an existing email": [
    'await page.goto(BASE + SHOP + "/signup");',
    'await page.getByLabel("Email").fill("demo@shopstack.demo");',
    'await page.getByRole("button", { name: "Create account" }).click();',
    'await expect(page.getByTestId("signup-error")).toBeVisible();',
    'await expect(page.getByTestId("signup-success")).toHaveCount(0);',
  ],
  "Search with no matches shows an empty state": [
    'await page.goto(BASE + SHOP + "/search");',
    'await page.getByLabel("Search products").fill("nothing-matches-this");',
    'await page.getByRole("button", { name: "Search" }).click();',
    'await expect(page.getByTestId("search-empty")).toBeVisible();',
    'await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();',
  ],
  "User changes their account email": [
    'await page.goto(BASE + SHOP + "/account/settings");',
    'await page.getByLabel("Email").fill("new-address@shopstack.demo");',
    'await page.getByRole("button", { name: "Save changes" }).click();',
    'await expect(page.getByTestId("account-saved")).toBeVisible();',
  ],
};

function specFor(title: string, body: string[]) {
  return [
    'import { test, expect } from "@playwright/test";',
    "",
    'const BASE = process.env.BASE_URL ?? "http://localhost:3000";',
    "const SHOP = " + SHOP + ";",
    "",
    "test(" + JSON.stringify(title) + ", async ({ page }) => {",
    ...body.map((l) => "  " + l),
    "});",
    "",
  ].join("\n");
}

const [project] = await db.select().from(schema.projects).where(eq(schema.projects.name, "ShopStack")).limit(1);
if (!project) {
  console.error("No ShopStack project found. Run npm run db:seed first.");
  process.exit(1);
}

const suites = await db.select().from(schema.testSuites).where(eq(schema.testSuites.projectId, project.id));
let attached = 0;
const missing: string[] = [];

for (const suite of suites) {
  const cases = await db.select().from(schema.testCases).where(eq(schema.testCases.suiteId, suite.id));
  for (const c of cases) {
    const body = BODIES[c.title];
    if (!body) {
      missing.push(c.title);
      continue;
    }
    await db
      .update(schema.testCases)
      .set({
        playwrightCode: specFor(c.title, body),
        automationStatus: "automated",
        filePathHint: "tests/" + suite.name.toLowerCase().replace(/\s+/g, "-") + ".spec.ts",
        updatedAt: new Date(),
      })
      .where(eq(schema.testCases.id, c.id));
    attached++;
  }
}

console.log("attached executable code to " + attached + " ShopStack test cases");
if (missing.length) console.log("no body written for: " + missing.join(", "));
