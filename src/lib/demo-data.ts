/**
 * Single source of truth for the demo. Every screen reads from here so the
 * story stays coherent: one workspace, one target app (ShopStack), one live
 * run (#137) containing one scripted failure that later self-heals.
 */

export type Status =
  | "passed"
  | "failed"
  | "flaky"
  | "healing"
  | "queued"
  | "running";

export const workspace = {
  name: "Acme Inc",
  plan: "Growth",
  minutesUsed: 1240,
  minutesTotal: 5000,
};

export const users = [
  { id: "aarav", name: "Aarav Mehta", initials: "AM", role: "Admin" },
  { id: "priya", name: "Priya Nair", initials: "PN", role: "Editor" },
  { id: "guest", name: "Guest", initials: "GU", role: "Viewer" },
];

export const project = {
  id: "shopstack",
  name: "ShopStack",
  url: "https://shopstack.demo",
  repo: "acme/shopstack",
  branch: "main",
  environment: "production",
  tests: 42,
  runs: 137,
  coverage: 78,
  passRate: 97.6,
};

export const projects = [
  {
    id: "shopstack",
    name: "ShopStack",
    source: "url" as const,
    target: "https://shopstack.demo",
    tests: 42,
    coverage: 78,
    lastRun: "2m ago",
    lastStatus: "failed" as Status,
  },
  {
    id: "acme-pay",
    name: "Acme Pay",
    source: "repo" as const,
    target: "acme/pay",
    tests: 26,
    coverage: 64,
    lastRun: "3h ago",
    lastStatus: "passed" as Status,
  },
  {
    id: "acme-docs",
    name: "Acme Docs",
    source: "repo" as const,
    target: "acme/docs",
    tests: 11,
    coverage: 41,
    lastRun: "1d ago",
    lastStatus: "flaky" as Status,
  },
];

export const apiEndpoints = [
  { method: "GET", path: "/api/products", status: 200, firstSeen: "00:04" },
  { method: "POST", path: "/api/cart", status: 201, firstSeen: "00:11" },
  { method: "POST", path: "/api/orders", status: 201, firstSeen: "00:26" },
  { method: "POST", path: "/api/auth/login", status: 200, firstSeen: "00:31" },
  { method: "GET", path: "/api/orders/:id", status: 200, firstSeen: "00:38" },
  { method: "POST", path: "/api/newsletter", status: 202, firstSeen: "00:44" },
  { method: "GET", path: "/api/user", status: 200, firstSeen: "00:52" },
  { method: "PATCH", path: "/api/user", status: 200, firstSeen: "01:03" },
  { method: "GET", path: "/api/search", status: 200, firstSeen: "01:12" },
];

export const discoveryFeed = [
  "Crawling /",
  "Found 12 links on /",
  "Crawling /products",
  "Captured GET /api/products",
  "Found form: newsletter-signup",
  "Crawling /products/wireless-mouse",
  "Captured POST /api/cart",
  "Crawling /cart",
  "Found form: checkout",
  "Crawling /checkout",
  "Captured POST /api/orders",
  "Detected auth wall on /account, using saved credentials",
  "Captured POST /api/auth/login",
  "Crawling /account/settings",
  "Captured PATCH /api/user",
  "Journey mapped: Product search to Checkout",
];

export const discoveredPages = [
  { path: "/", title: "Home", forms: 1, apis: 1, gated: false, risk: "High traffic" },
  { path: "/products", title: "Product listing", forms: 1, apis: 2, gated: false, risk: "High traffic" },
  { path: "/products/:slug", title: "Product detail", forms: 1, apis: 2, gated: false, risk: "Recently changed" },
  { path: "/cart", title: "Cart", forms: 1, apis: 2, gated: false, risk: "Revenue path" },
  { path: "/checkout", title: "Checkout", forms: 2, apis: 3, gated: false, risk: "Revenue path" },
  { path: "/login", title: "Sign in", forms: 1, apis: 1, gated: false, risk: "Auth" },
  { path: "/signup", title: "Create account", forms: 1, apis: 1, gated: false, risk: "Auth" },
  { path: "/account", title: "Account overview", forms: 0, apis: 2, gated: true, risk: "Auth" },
  { path: "/account/settings", title: "Account settings", forms: 3, apis: 2, gated: true, risk: "Recently changed" },
  { path: "/account/orders", title: "Order history", forms: 0, apis: 1, gated: true, risk: "Low traffic" },
  { path: "/search", title: "Search results", forms: 1, apis: 1, gated: false, risk: "High traffic" },
  { path: "/support", title: "Support", forms: 1, apis: 0, gated: false, risk: "Low traffic" },
];

export const journeys = [
  { id: "signup", name: "Sign up", cases: 6, description: "New visitor creates an account and verifies their email." },
  { id: "login", name: "Login", cases: 5, description: "Returning customer authenticates, including failure paths." },
  { id: "search", name: "Product search", cases: 7, description: "Visitor searches the catalogue and filters results." },
  { id: "cart", name: "Cart", cases: 8, description: "Customer adds, updates and removes cart items." },
  { id: "checkout", name: "Checkout", cases: 11, description: "Customer completes payment, including declined cards." },
  { id: "account", name: "Account settings", cases: 5, description: "Customer updates their profile and preferences." },
];

/**
 * Headline crawl figures — the single source for every screen that quotes them
 * (Overview, Discovery, Application Map).
 *
 * These intentionally exceed the sample arrays above: the crawl found 28 pages
 * and 14 journeys, while `discoveredPages`/`journeys` carry a representative
 * subset for the UI to render. They previously lived as loose literals on
 * `project`, which let the Map disagree with the Overview; keeping one exported
 * object means a change lands everywhere at once.
 */
export const discoveryStats = {
  pages: 28,
  journeys: 14,
  apis: apiEndpoints.length,
};

export type TestCase = {
  id: string;
  journey: string;
  title: string;
  expectation: string;
  tags: string[];
  steps: string[];
  approved: boolean;
  star?: boolean;
};

export const testPlan: TestCase[] = [
  {
    id: "tc-checkout-expired",
    journey: "checkout",
    title: "User checks out with an expired card",
    expectation: "Payment declined message shown, order not created",
    tags: ["edge-case", "negative", "smoke"],
    steps: [
      "Add 'Wireless Mouse' to the cart",
      "Open checkout",
      "Enter card 4242 4242 4242 4242 expiring 01/24",
      "Submit payment",
      "Assert the decline message is visible",
      "Assert no order appears in order history",
    ],
    approved: true,
    star: true,
  },
  {
    id: "tc-checkout-happy",
    journey: "checkout",
    title: "User completes checkout with a valid card",
    expectation: "Order confirmation shown with an order number",
    tags: ["happy-path", "smoke"],
    steps: [
      "Add 'Wireless Mouse' to the cart",
      "Open checkout",
      "Enter a valid test card",
      "Submit payment",
      "Assert the confirmation page shows an order number",
    ],
    approved: true,
  },
  {
    id: "tc-checkout-empty-cart",
    journey: "checkout",
    title: "Checkout is blocked when the cart is empty",
    expectation: "User is redirected to the cart with an empty-state message",
    tags: ["negative"],
    steps: [
      "Open checkout with an empty cart",
      "Assert redirect to /cart",
      "Assert the empty-state message",
    ],
    approved: true,
  },
  {
    id: "tc-cart-quantity",
    journey: "cart",
    title: "User updates the quantity of a cart item",
    expectation: "Line total and cart total both recalculate",
    tags: ["happy-path"],
    steps: [
      "Add an item to the cart",
      "Set the quantity to three",
      "Assert the line total updates",
      "Assert the cart total updates",
    ],
    approved: true,
  },
  {
    id: "tc-cart-remove",
    journey: "cart",
    title: "User removes the last item from the cart",
    expectation: "Cart shows the empty state and the badge clears",
    tags: ["edge-case"],
    steps: [
      "Add one item",
      "Remove the item",
      "Assert the empty state",
      "Assert the header badge shows zero",
    ],
    approved: true,
  },
  {
    id: "tc-login-wrong-password",
    journey: "login",
    title: "Login fails with an incorrect password",
    expectation: "Inline error shown, user stays signed out",
    tags: ["negative", "auth"],
    steps: [
      "Open /login",
      "Enter a known email and a wrong password",
      "Submit",
      "Assert the inline error",
      "Assert no session cookie is set",
    ],
    approved: true,
  },
  {
    id: "tc-login-lockout",
    journey: "login",
    title: "Account locks after five failed attempts",
    expectation: "Lockout notice shown and further attempts rejected",
    tags: ["edge-case", "negative", "auth"],
    steps: [
      "Submit five incorrect passwords",
      "Assert the lockout notice",
      "Assert the sixth attempt is rejected",
    ],
    approved: false,
  },
  {
    id: "tc-signup-existing",
    journey: "signup",
    title: "Sign up is rejected for an existing email",
    expectation: "Duplicate-email error shown, no account created",
    tags: ["negative"],
    steps: [
      "Open /signup",
      "Enter an email that already exists",
      "Submit",
      "Assert the duplicate-email error",
    ],
    approved: false,
  },
  {
    id: "tc-search-no-results",
    journey: "search",
    title: "Search with no matches shows an empty state",
    expectation: "Empty state with a suggestion to clear filters",
    tags: ["edge-case"],
    steps: [
      "Search for a term with no matches",
      "Assert the empty state",
      "Assert the clear-filters link is present",
    ],
    approved: false,
  },
  {
    id: "tc-account-email",
    journey: "account",
    title: "User changes their account email",
    expectation: "Confirmation banner shown and PATCH /api/user succeeds",
    tags: ["happy-path", "auth"],
    steps: [
      "Sign in",
      "Open account settings",
      "Change the email",
      "Save",
      "Assert the confirmation banner",
    ],
    approved: false,
  },
];

export const planStats = {
  total: 42,
  happy: 14,
  edge: 16,
  negative: 12,
  approved: 38,
};

export const starTestCode = [
  "import { test, expect } from '@playwright/test';",
  "",
  "test('user checks out with an expired card', async ({ page }) => {",
  "  await page.goto('/products/wireless-mouse');",
  "  await page.getByRole('button', { name: 'Add to cart' }).click();",
  "",
  "  await page.goto('/checkout');",
  "  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();",
  "",
  "  await page.getByLabel('Card number').fill('4242424242424242');",
  "  await page.getByLabel('Expiry').fill('01/24');",
  "  await page.getByLabel('CVC').fill('123');",
  "",
  "  // Locator healed by Parikshan on run #137 (was '#pay-btn')",
  "  await page.getByRole('button', { name: 'Place order' }).click();",
  "",
  "  await expect(page.getByRole('alert')).toHaveText(/card has expired/i);",
  "  await expect(page).toHaveURL('/checkout');",
  "",
  "  const orders = await page.request.get('/api/orders');",
  "  expect((await orders.json()).items).toHaveLength(0);",
  "});",
].join("\n");

export const testVersions = [
  { version: "v2", author: "Parikshan", note: "Locator healed on run #137", when: "2m ago" },
  { version: "v1", author: "Parikshan", note: "Generated from approved plan", when: "3d ago" },
];

export const generatedTests = [
  {
    id: "tc-checkout-expired",
    name: "user checks out with an expired card",
    journey: "Checkout",
    status: "failed" as Status,
    duration: "4.2s",
    history: ["passed", "passed", "passed", "passed", "passed", "passed", "failed"] as Status[],
    tags: ["smoke", "negative"],
  },
  {
    id: "tc-checkout-happy",
    name: "user completes checkout with a valid card",
    journey: "Checkout",
    status: "passed" as Status,
    duration: "5.1s",
    history: ["passed", "passed", "passed", "passed", "passed", "passed", "passed"] as Status[],
    tags: ["smoke"],
  },
  {
    id: "tc-cart-quantity",
    name: "user updates the quantity of a cart item",
    journey: "Cart",
    status: "passed" as Status,
    duration: "2.4s",
    history: ["passed", "passed", "passed", "passed", "passed", "passed", "passed"] as Status[],
    tags: ["happy-path"],
  },
  {
    id: "tc-cart-remove",
    name: "user removes the last item from the cart",
    journey: "Cart",
    status: "passed" as Status,
    duration: "2.1s",
    history: ["passed", "failed", "passed", "passed", "passed", "passed", "passed"] as Status[],
    tags: ["edge-case"],
  },
  {
    id: "tc-login-wrong-password",
    name: "login fails with an incorrect password",
    journey: "Login",
    status: "passed" as Status,
    duration: "1.8s",
    history: ["passed", "passed", "passed", "passed", "passed", "passed", "passed"] as Status[],
    tags: ["negative", "auth"],
  },
  {
    id: "tc-newsletter",
    name: "visitor subscribes to the newsletter",
    journey: "Sign up",
    status: "flaky" as Status,
    duration: "3.6s",
    history: ["passed", "failed", "passed", "passed", "failed", "passed", "passed"] as Status[],
    tags: ["quarantined"],
  },
  {
    id: "tc-search-no-results",
    name: "search with no matches shows an empty state",
    journey: "Product search",
    status: "passed" as Status,
    duration: "1.5s",
    history: ["passed", "passed", "passed", "passed", "passed", "passed", "passed"] as Status[],
    tags: ["edge-case"],
  },
  {
    id: "tc-account-email",
    name: "user changes their account email",
    journey: "Account settings",
    status: "passed" as Status,
    duration: "3.9s",
    history: ["passed", "passed", "passed", "passed", "passed", "passed", "passed"] as Status[],
    tags: ["auth"],
  },
];

export const runs = [
  { id: 137, trigger: "PR #482", branch: "main", started: "2m ago", duration: "1m 12s", passed: 41, failed: 1, flaky: 0, status: "failed" as Status, initiator: "AM" },
  { id: 136, trigger: "cron", branch: "main", started: "6h ago", duration: "1m 08s", passed: 42, failed: 0, flaky: 0, status: "passed" as Status, initiator: "PN" },
  { id: 135, trigger: "PR #479", branch: "feat/cart-badge", started: "9h ago", duration: "1m 21s", passed: 41, failed: 0, flaky: 1, status: "flaky" as Status, initiator: "PN" },
  { id: 134, trigger: "manual", branch: "main", started: "1d ago", duration: "1m 04s", passed: 42, failed: 0, flaky: 0, status: "passed" as Status, initiator: "AM" },
  { id: 133, trigger: "cron", branch: "main", started: "1d ago", duration: "1m 11s", passed: 42, failed: 0, flaky: 0, status: "passed" as Status, initiator: "PN" },
  { id: 132, trigger: "PR #476", branch: "fix/checkout-copy", started: "2d ago", duration: "1m 19s", passed: 40, failed: 2, flaky: 0, status: "failed" as Status, initiator: "AM" },
];

export const executionCells = [
  { browser: "Chromium", shard: 1, progress: 100, status: "passed" as Status, line: "cart.spec.ts:42" },
  { browser: "Chromium", shard: 2, progress: 100, status: "passed" as Status, line: "search.spec.ts:18" },
  { browser: "Chromium", shard: 3, progress: 100, status: "failed" as Status, line: "checkout.spec.ts:18" },
  { browser: "Firefox", shard: 1, progress: 100, status: "passed" as Status, line: "login.spec.ts:11" },
  { browser: "Firefox", shard: 2, progress: 100, status: "passed" as Status, line: "account.spec.ts:27" },
  { browser: "Firefox", shard: 3, progress: 100, status: "passed" as Status, line: "cart.spec.ts:9" },
  { browser: "WebKit", shard: 1, progress: 100, status: "passed" as Status, line: "signup.spec.ts:14" },
  { browser: "WebKit", shard: 2, progress: 92, status: "running" as Status, line: "search.spec.ts:31" },
  { browser: "WebKit", shard: 3, progress: 100, status: "passed" as Status, line: "checkout.spec.ts:52" },
];

export const failure = {
  test: "user checks out with an expired card",
  testId: "tc-checkout-expired",
  step: 4,
  totalSteps: 7,
  browser: "Chromium",
  run: 137,
  selector: "getByRole('button', { name: 'Pay now' })",
  healedSelector: "getByRole('button', { name: 'Place order' })",
  commit: "a1b2c3d",
  rootCause:
    "The 'Pay now' button's accessible name changed to 'Place order' in commit a1b2c3d. The element is otherwise identical: same position in the DOM, same class list, same click handler.",
  confidence: "High",
  steps: [
    { n: 1, text: "Navigate to /products/wireless-mouse", status: "passed" as Status },
    { n: 2, text: "Click 'Add to cart'", status: "passed" as Status },
    { n: 3, text: "Navigate to /checkout", status: "passed" as Status },
    { n: 4, text: "Click 'Pay now'", status: "failed" as Status },
    { n: 5, text: "Assert the decline message", status: "queued" as Status },
    { n: 6, text: "Assert the URL is /checkout", status: "queued" as Status },
    { n: 7, text: "Assert no order was created", status: "queued" as Status },
  ],
  networkLog: [
    { method: "GET", path: "/api/products/wireless-mouse", status: 200, ms: 84 },
    { method: "POST", path: "/api/cart", status: 201, ms: 112 },
    { method: "GET", path: "/api/cart", status: 200, ms: 41 },
  ],
  consoleLog: [
    "[info] checkout form mounted",
    "[warn] deprecated prop 'legacyPay' on PayButton",
    "[error] Timeout 5000ms exceeded waiting for locator",
  ],
};

export const healingEvents = [
  {
    id: "he-1",
    test: "user checks out with an expired card",
    when: "2 minutes ago",
    oldSelector: "#pay-btn",
    newSelector: "getByRole('button', { name: 'Place order' })",
    similarity: 94,
    reason: "Matched by DOM similarity, text content and position within the form.",
    status: "pending" as const,
  },
  {
    id: "he-2",
    test: "user completes checkout with a valid card",
    when: "2 minutes ago",
    oldSelector: "#pay-btn",
    newSelector: "getByRole('button', { name: 'Place order' })",
    similarity: 94,
    reason: "Same element as the failure above, healed across the whole suite.",
    status: "accepted" as const,
  },
  {
    id: "he-3",
    test: "user updates the quantity of a cart item",
    when: "yesterday",
    oldSelector: ".qty-input",
    newSelector: "getByLabel('Quantity')",
    similarity: 88,
    reason: "Class renamed during a CSS-module migration; the label text was unchanged.",
    status: "accepted" as const,
  },
  {
    id: "he-4",
    test: "visitor subscribes to the newsletter",
    when: "3 days ago",
    oldSelector: "form > button:nth-child(2)",
    newSelector: "getByRole('button', { name: 'Subscribe' })",
    similarity: 91,
    reason: "Structural selector replaced with a role-based one after a layout change.",
    status: "accepted" as const,
  },
];

export const healingStats = { healedThisMonth: 31, hoursSaved: 6, healedToday: 3 };

export const quarantined = [
  {
    test: "visitor subscribes to the newsletter",
    score: 62,
    pattern: "Fails 1 in 5 on WebKit only",
    flagged: "4 days ago",
    variance: [1, 0, 1, 1, 0, 1, 1, 1, 0, 1],
  },
  {
    test: "product grid lazy-loads on scroll",
    score: 38,
    pattern: "Fails when the run is sharded above six workers",
    flagged: "9 days ago",
    variance: [1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
  },
];

export const coverageTrend = [62, 64, 63, 67, 70, 69, 72, 74, 73, 76, 77, 78];
export const passRateTrend = [91, 93, 92, 95, 94, 96, 95, 97, 96, 98, 97, 97.6];
export const minutesTrend = [820, 910, 960, 1010, 1080, 1120, 1180, 1240];

export const failureClusters = [
  { name: "Checkout failures", tests: 6, cause: "Payment iframe timeout on slow shards" },
  { name: "Auth-gated pages", tests: 3, cause: "Session cookie not restored before navigation" },
  { name: "Search filters", tests: 2, cause: "Debounce race on rapid input" },
];

export const notifications = [
  { id: 1, type: "failed" as Status, title: "Run #137 failed", body: "1 of 42 tests failed on Chromium.", when: "2m ago", day: "Today", unread: true },
  { id: 2, type: "healing" as Status, title: "Locator healed automatically", body: "'Pay now' is now 'Place order' across 2 tests.", when: "2m ago", day: "Today", unread: true },
  { id: 3, type: "flaky" as Status, title: "Test quarantined", body: "Newsletter signup fails 1 in 5 on WebKit.", when: "4h ago", day: "Today", unread: true },
  { id: 4, type: "passed" as Status, title: "Quality gate passed", body: "PR #479 — 42 of 42 tests passed.", when: "9h ago", day: "Yesterday", unread: false },
  { id: 5, type: "passed" as Status, title: "Scheduled run completed", body: "Run #136 finished in 1m 08s.", when: "1d ago", day: "Yesterday", unread: false },
];

export const integrationCards = [
  { name: "GitHub Actions", description: "Run the suite on every pull request and gate merges.", connected: true },
  { name: "Slack", description: "Post failures, healed locators and daily summaries to a channel.", connected: true },
  { name: "Jira", description: "File a bug automatically when a test fails.", connected: false },
  { name: "Linear", description: "Sync failures to issues.", connected: false, soon: true },
  { name: "GitLab CI", description: "Trigger runs from GitLab pipelines.", connected: false, soon: true },
  { name: "CircleCI", description: "Trigger runs from CircleCI workflows.", connected: false, soon: true },
];

export const workflowYaml = [
  "name: e2e",
  "on: [pull_request]",
  "",
  "jobs:",
  "  parikshan:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - uses: parikshan/run-action@v1",
  "        with:",
  "          project: shopstack",
  "          gate: smoke",
].join("\n");

export const apiKeys = [
  { name: "CI (GitHub Actions)", key: "psk_live_9f2a...c41d", created: "12 Mar 2026", lastUsed: "2m ago" },
  { name: "Local development", key: "psk_test_4b81...77ae", created: "02 Apr 2026", lastUsed: "yesterday" },
];

export const invoices = [
  { id: "INV-0042", date: "01 Aug 2026", amount: "$248.00", status: "Paid" },
  { id: "INV-0041", date: "01 Jul 2026", amount: "$212.00", status: "Paid" },
  { id: "INV-0040", date: "01 Jun 2026", amount: "$196.00", status: "Paid" },
];
