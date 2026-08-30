/**
 * PRD analysis demo data.
 *
 * The story: a product manager drops the "Express Checkout" PRD in, Parikshan
 * reads it, extracts atomic requirements, flags the ones that are ambiguous or
 * untestable as written, and proposes test cases traced back to each
 * requirement. Everything below is deliberately consistent with the ShopStack
 * dataset in demo-data.ts.
 */

export type RequirementKind = "functional" | "non-functional" | "security" | "accessibility";
export type Priority = "P0" | "P1" | "P2";
export type CoverageState = "covered" | "partial" | "gap";

export const samplePrd = [
  "# Express Checkout — Product Requirements",
  "",
  "## Background",
  "",
  "Cart abandonment on ShopStack sits at 68% for returning customers. Analysis",
  "shows most drop-off happens on the address and payment steps, which returning",
  "customers have already completed at least once before.",
  "",
  "## Goal",
  "",
  "Let a returning, signed-in customer complete a purchase from the cart in a",
  "single confirmation step using their saved address and saved card.",
  "",
  "## Requirements",
  "",
  "1. A signed-in customer with at least one saved address and one saved payment",
  "   method sees an 'Express checkout' button on the cart page.",
  "2. Clicking 'Express checkout' opens a confirmation sheet showing the default",
  "   address, default card (last four digits only), order total and delivery",
  "   estimate.",
  "3. The customer can change the address or card from within the sheet without",
  "   leaving the cart page.",
  "4. Confirming places the order and shows an order confirmation with the order",
  "   number.",
  "5. If the saved card is declined, the sheet stays open and shows the decline",
  "   reason. No order is created.",
  "6. Guests, and signed-in customers with no saved payment method, continue to",
  "   the existing multi-step checkout unchanged.",
  "7. The confirmation sheet must open in under 300ms on a median connection.",
  "8. All payment data continues to be tokenised. The application never stores",
  "   raw card numbers.",
  "9. The sheet must be fully operable by keyboard and announced correctly by",
  "   screen readers.",
  "10. Express checkout should be quick for most users.",
  "",
  "## Out of scope",
  "",
  "- Gift cards and store credit",
  "- Split payment across multiple cards",
  "- Subscription products",
].join("\n");

export type Requirement = {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: Priority;
  coverage: CoverageState;
  cases: number;
  /** Present when the requirement cannot be tested as written. */
  ambiguity?: string;
};

export const requirements: Requirement[] = [
  {
    id: "REQ-1",
    text: "Signed-in customer with a saved address and card sees the Express checkout button on the cart page.",
    kind: "functional",
    priority: "P0",
    coverage: "covered",
    cases: 3,
  },
  {
    id: "REQ-2",
    text: "Confirmation sheet shows default address, masked card, order total and delivery estimate.",
    kind: "functional",
    priority: "P0",
    coverage: "covered",
    cases: 4,
  },
  {
    id: "REQ-3",
    text: "Customer can change address or card inside the sheet without leaving the cart.",
    kind: "functional",
    priority: "P1",
    coverage: "covered",
    cases: 3,
  },
  {
    id: "REQ-4",
    text: "Confirming places the order and shows a confirmation with the order number.",
    kind: "functional",
    priority: "P0",
    coverage: "covered",
    cases: 2,
  },
  {
    id: "REQ-5",
    text: "Declined saved card keeps the sheet open, shows the decline reason, creates no order.",
    kind: "functional",
    priority: "P0",
    coverage: "covered",
    cases: 4,
  },
  {
    id: "REQ-6",
    text: "Guests and customers without a saved card fall through to the existing checkout.",
    kind: "functional",
    priority: "P1",
    coverage: "partial",
    cases: 2,
    ambiguity:
      "The PRD does not say what happens to a customer who has a saved card but no saved address. Two cases assume the fallback path; confirm before generating.",
  },
  {
    id: "REQ-7",
    text: "Confirmation sheet opens in under 300ms on a median connection.",
    kind: "non-functional",
    priority: "P1",
    coverage: "partial",
    cases: 1,
    ambiguity:
      "'Median connection' is undefined. The generated test asserts against a 4G throttling profile; adjust the budget if that is not your baseline.",
  },
  {
    id: "REQ-8",
    text: "Payment data is tokenised. Raw card numbers are never stored.",
    kind: "security",
    priority: "P0",
    coverage: "partial",
    cases: 2,
    ambiguity:
      "Storage is a backend guarantee. UI tests can only assert that no raw PAN appears in network payloads, local storage or the DOM.",
  },
  {
    id: "REQ-9",
    text: "The sheet is fully keyboard operable and correctly announced to screen readers.",
    kind: "accessibility",
    priority: "P1",
    coverage: "covered",
    cases: 4,
  },
  {
    id: "REQ-10",
    text: "Express checkout should be quick for most users.",
    kind: "non-functional",
    priority: "P2",
    coverage: "gap",
    cases: 0,
    ambiguity:
      "Not testable as written. 'Quick' and 'most users' have no threshold. This duplicates REQ-7, which is measurable. Recommend deleting or merging.",
  },
];

export type PrdTestCase = {
  id: string;
  requirement: string;
  title: string;
  expectation: string;
  tags: string[];
  priority: Priority;
  steps: string[];
  approved: boolean;
};

export const prdTestCases: PrdTestCase[] = [
  {
    id: "PRD-TC-01",
    requirement: "REQ-1",
    title: "Express checkout button appears for an eligible returning customer",
    expectation: "Button is visible on the cart page above the standard checkout button",
    tags: ["happy-path", "smoke"],
    priority: "P0",
    steps: [
      "Sign in as a customer with a saved address and a saved card",
      "Add 'Wireless Mouse' to the cart",
      "Open the cart page",
      "Assert the Express checkout button is visible",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-02",
    requirement: "REQ-1",
    title: "Express checkout is hidden when the customer has no saved card",
    expectation: "Only the standard checkout button is shown",
    tags: ["negative"],
    priority: "P0",
    steps: [
      "Sign in as a customer with a saved address but no saved card",
      "Open the cart page",
      "Assert the Express checkout button is absent",
      "Assert the standard checkout button is visible",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-03",
    requirement: "REQ-2",
    title: "Confirmation sheet shows the masked card and full order total",
    expectation: "Sheet shows last four digits only, address, total and delivery estimate",
    tags: ["happy-path", "smoke"],
    priority: "P0",
    steps: [
      "Open the cart as an eligible customer",
      "Click Express checkout",
      "Assert the sheet shows the default address",
      "Assert the card is rendered as four digits preceded by masking characters",
      "Assert the order total matches the cart total",
      "Assert a delivery estimate is present",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-04",
    requirement: "REQ-2",
    title: "Full card number never appears in the confirmation sheet",
    expectation: "No sixteen digit sequence is present anywhere in the sheet markup",
    tags: ["security", "negative"],
    priority: "P0",
    steps: [
      "Open the express checkout sheet",
      "Read the full sheet markup",
      "Assert no sixteen digit sequence is present",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-05",
    requirement: "REQ-3",
    title: "Customer switches to a second saved address without leaving the cart",
    expectation: "Sheet updates the address and the delivery estimate, URL is unchanged",
    tags: ["happy-path"],
    priority: "P1",
    steps: [
      "Open the express checkout sheet",
      "Click Change address",
      "Select the second saved address",
      "Assert the sheet shows the new address",
      "Assert the delivery estimate recalculates",
      "Assert the page URL is still the cart",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-06",
    requirement: "REQ-4",
    title: "Confirming express checkout creates the order",
    expectation: "Confirmation page shows an order number and the cart is emptied",
    tags: ["happy-path", "smoke"],
    priority: "P0",
    steps: [
      "Open the express checkout sheet",
      "Click Place order",
      "Assert the confirmation shows an order number",
      "Assert the cart badge shows zero",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-07",
    requirement: "REQ-5",
    title: "Declined saved card keeps the sheet open and creates no order",
    expectation: "Decline reason is shown, sheet stays open, order history is unchanged",
    tags: ["negative", "edge-case", "smoke"],
    priority: "P0",
    steps: [
      "Sign in as a customer whose saved card is configured to decline",
      "Open the express checkout sheet",
      "Click Place order",
      "Assert the decline reason is visible inside the sheet",
      "Assert the sheet is still open",
      "Assert no new order appears in order history",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-08",
    requirement: "REQ-5",
    title: "Customer recovers from a decline by switching cards",
    expectation: "Second card succeeds and the order is created",
    tags: ["edge-case"],
    priority: "P1",
    steps: [
      "Trigger a decline on the first saved card",
      "Click Change card",
      "Select the second saved card",
      "Click Place order",
      "Assert the confirmation shows an order number",
    ],
    approved: false,
  },
  {
    id: "PRD-TC-09",
    requirement: "REQ-6",
    title: "Guest checkout is unchanged",
    expectation: "Guest is routed to the existing multi-step checkout",
    tags: ["regression"],
    priority: "P1",
    steps: [
      "Add an item to the cart while signed out",
      "Open the cart",
      "Assert the Express checkout button is absent",
      "Click Checkout and assert the address step is shown",
    ],
    approved: false,
  },
  {
    id: "PRD-TC-10",
    requirement: "REQ-7",
    title: "Confirmation sheet opens within the performance budget",
    expectation: "Time from click to sheet visible is under 300ms on a 4G profile",
    tags: ["performance"],
    priority: "P1",
    steps: [
      "Apply a 4G network throttling profile",
      "Open the cart as an eligible customer",
      "Measure from the Express checkout click to the sheet becoming visible",
      "Assert the measured duration is under 300 milliseconds",
    ],
    approved: false,
  },
  {
    id: "PRD-TC-11",
    requirement: "REQ-8",
    title: "No raw card number is sent, stored or rendered",
    expectation: "Network payloads, local storage and the DOM contain no PAN",
    tags: ["security"],
    priority: "P0",
    steps: [
      "Record all network traffic during an express checkout",
      "Assert no request body contains a sixteen digit card number",
      "Assert local storage contains no card number",
      "Assert the DOM contains no card number",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-12",
    requirement: "REQ-9",
    title: "Sheet traps focus and is fully keyboard operable",
    expectation: "Focus moves into the sheet, cycles within it, and Escape closes it",
    tags: ["accessibility"],
    priority: "P1",
    steps: [
      "Open the express checkout sheet using the keyboard only",
      "Assert focus moves to the first control inside the sheet",
      "Tab to the last control and assert focus cycles back into the sheet",
      "Press Escape and assert the sheet closes",
      "Assert focus returns to the Express checkout button",
    ],
    approved: true,
  },
  {
    id: "PRD-TC-13",
    requirement: "REQ-9",
    title: "Sheet is announced as a modal dialog with an accessible name",
    expectation: "Sheet exposes a dialog role, a name, and a modal state",
    tags: ["accessibility"],
    priority: "P1",
    steps: [
      "Open the express checkout sheet",
      "Assert the sheet exposes the dialog role",
      "Assert it has a non-empty accessible name",
      "Assert content behind the sheet is hidden from assistive technology",
    ],
    approved: true,
  },
];

/** Steps the analyser walks through, shown live while it works. */
export const analysisStages = [
  { label: "Reading document", detail: "1,842 words · 10 numbered requirements" },
  { label: "Extracting atomic requirements", detail: "Splitting compound statements" },
  { label: "Classifying by type", detail: "Functional, performance, security, accessibility" },
  { label: "Detecting ambiguity", detail: "Flagging untestable or underspecified wording" },
  { label: "Mapping to application map", detail: "Matching against cart and checkout journeys" },
  { label: "Proposing test cases", detail: "Happy paths, edge cases, negatives" },
];

export const prdDocuments = [
  {
    id: "express-checkout",
    title: "Express Checkout",
    source: "Pasted",
    words: 1842,
    requirements: 10,
    cases: 13,
    ambiguities: 4,
    analysed: "2 minutes ago",
    status: "analysed" as const,
  },
  {
    id: "loyalty-tiers",
    title: "Loyalty Tiers v2",
    source: "Confluence",
    words: 2610,
    requirements: 14,
    cases: 19,
    ambiguities: 2,
    analysed: "3 days ago",
    status: "analysed" as const,
  },
  {
    id: "returns-portal",
    title: "Self-Serve Returns Portal",
    source: "Uploaded PDF",
    words: 3120,
    requirements: 17,
    cases: 0,
    ambiguities: 0,
    analysed: "—",
    status: "draft" as const,
  },
];

export const prdStats = {
  requirements: 10,
  testable: 9,
  cases: 13,
  ambiguities: 4,
  coverage: 88,
};
