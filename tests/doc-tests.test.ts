// Verifies the pure Doc Tests logic — heuristic requirement extraction
// (heuristic.ts) and the Gemini call/prompt (gemini.ts, mocked fetch) —
// no MongoDB needed.
//
//   node --test tests/doc-tests.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { extractRequirements, requirementsToScenarios } from "../src/lib/doc-tests/heuristic.ts";
import { buildDocPrompt, requestDocScenariosFromGemini } from "../src/lib/doc-tests/gemini.ts";

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

describe("extractRequirements", () => {
  test("finds sentences with normative keywords", () => {
    const doc =
      "This is a general intro. The API must reject payloads missing an id. Thanks for reading.";
    const requirements = extractRequirements(doc);
    assert.equal(requirements.length, 1);
    assert.match(requirements[0]!.sentence, /must reject payloads/);
    assert.equal(requirements[0]!.keyword, "must");
  });

  test("ignores sentences with no requirement keyword", () => {
    const requirements = extractRequirements("This library is fast. It has zero dependencies.");
    assert.equal(requirements.length, 0);
  });

  test("caps results at the given max", () => {
    const doc = Array.from({ length: 20 }, (_, i) => `Endpoint ${i} must return JSON.`).join(" ");
    assert.equal(extractRequirements(doc, 3).length, 3);
  });
});

describe("requirementsToScenarios", () => {
  test("types a 'returns'/'throws' requirement as API", () => {
    const [scenario] = requirementsToScenarios([
      { sentence: "The function throws on invalid input.", keyword: "throws" },
    ]);
    assert.equal(scenario!.type, "API");
    assert.match(scenario!.filePath!, /^tests\/api\//);
  });

  test("types a plain must/should requirement as E2E", () => {
    const [scenario] = requirementsToScenarios([
      { sentence: "Users must confirm their email before logging in.", keyword: "must" },
    ]);
    assert.equal(scenario!.type, "E2E");
    assert.match(scenario!.filePath!, /^tests\/e2e\//);
  });
});

describe("buildDocPrompt", () => {
  test("includes the title and doc text", () => {
    const prompt = buildDocPrompt("Auth API", "Tokens expire after 1 hour.");
    assert.match(prompt, /Auth API/);
    assert.match(prompt, /Tokens expire after 1 hour\./);
    assert.match(prompt, /"scenarios"/);
  });
});

describe("requestDocScenariosFromGemini", () => {
  test("parses and validates Gemini's JSON response", async () => {
    const scenarios = [
      {
        type: "API",
        title: "Token expires after 1 hour",
        description: "A token issued more than 1 hour ago is rejected.",
        priority: "high",
        filePath: "tests/api/token-expiry.spec.ts",
      },
    ];
    globalThis.fetch = (async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ scenarios }) }] } }],
      })) as typeof fetch;

    const result = await requestDocScenariosFromGemini("prompt");
    assert.deepEqual(result, scenarios);
  });

  test("throws when GOOGLE_API_KEY is missing", async () => {
    delete process.env["GOOGLE_API_KEY"];
    await assert.rejects(
      () => requestDocScenariosFromGemini("prompt"),
      /GOOGLE_API_KEY is not configured/,
    );
  });
});
