import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the suites Parikshan generates and executes.
 *
 * Specs are written per run into parikshan-runs/<runId>, so testDir points
 * there rather than at a checked-in tests folder. Retries stay at zero: a
 * retried failure would report as passing and hide exactly the flakiness the
 * product exists to surface.
 */
export default defineConfig({
  testDir: "./parikshan-runs",
  timeout: 20_000,
  expect: { timeout: 5_000 },
  retries: 0,
  fullyParallel: true,
  reporter: [["json"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "off",
    // "on" rather than "only-on-failure": a passing screenshot is the baseline
    // a later failure gets compared against, and at this suite size the cost
    // is a few hundred milliseconds.
    screenshot: "on",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
