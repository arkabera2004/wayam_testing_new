// Verifies the pure Synthetic Data fallback generator
// (src/lib/synthetic-data/fallback.ts) and the Gemini prompt/call
// (gemini.ts, mocked fetch) — no MongoDB needed.
//
//   node --test tests/synthetic-data.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { generateFallbackDataset } from "../src/lib/synthetic-data/fallback.ts";
import {
  buildSyntheticDataPrompt,
  requestSyntheticDataFromGemini,
} from "../src/lib/synthetic-data/gemini.ts";

const originalFetch = globalThis.fetch;
const originalGoogleKey = process.env["GOOGLE_API_KEY"];

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env["GOOGLE_API_KEY"] = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGoogleKey === undefined) delete process.env["GOOGLE_API_KEY"];
  else process.env["GOOGLE_API_KEY"] = originalGoogleKey;
});

describe("generateFallbackDataset", () => {
  test("guesses an email field from scenario text mentioning email", () => {
    const records = generateFallbackDataset("User signs up with a valid email address", 3);
    assert.equal(records.length, 3);
    assert.ok(typeof records[0]!["email"] === "string");
    assert.match(records[0]!["email"] as string, /@example\.com$/);
  });

  test("produces distinct values across records, not copies", () => {
    const records = generateFallbackDataset("Checkout with a quantity", 2);
    assert.notEqual(records[0]!["quantity"], records[1]!["quantity"]);
  });

  test("falls back to a generic 'value' field when nothing matches", () => {
    const records = generateFallbackDataset("Something happens", 1);
    assert.ok("value" in records[0]!);
  });

  test("combines multiple matched fields into one record", () => {
    const records = generateFallbackDataset("Create a user with name and email", 1);
    assert.ok("name" in records[0]!);
    assert.ok("email" in records[0]!);
  });
});

describe("buildSyntheticDataPrompt", () => {
  test("includes the scenario text and requested count", () => {
    const prompt = buildSyntheticDataPrompt("Signup with a valid email", 5);
    assert.match(prompt, /Signup with a valid email/);
    assert.match(prompt, /5/);
    assert.match(prompt, /"records"/);
  });
});

describe("requestSyntheticDataFromGemini", () => {
  test("parses Gemini's JSON records array", async () => {
    const records = [{ email: "a@example.com" }, { email: "b@example.com" }];
    globalThis.fetch = (async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ records }) }] } }],
      })) as typeof fetch;

    const result = await requestSyntheticDataFromGemini("prompt");
    assert.deepEqual(result, records);
  });

  test("throws when GOOGLE_API_KEY is missing", async () => {
    delete process.env["GOOGLE_API_KEY"];
    await assert.rejects(
      () => requestSyntheticDataFromGemini("prompt"),
      /GOOGLE_API_KEY is not configured/,
    );
  });
});
