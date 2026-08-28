// Verifies the real GitHub-repo scenario-generation pipeline
// (src/lib/projects/scenario-generation.server.ts): parsing a repo out of a
// source URL, prompting Gemini with real repo context, and validating its
// response into the same shape the old starterScenarios() stub produced.
//
// No MongoDB needed here (this module doesn't touch it) — global fetch is
// stubbed to stand in for both the GitHub API and the Gemini API, so this
// runs with plain `node --test`, same as tests/org-isolation.test.ts.
//
//   node --test tests/scenario-generation.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import {
  buildScenarioPrompt,
  fetchGithubRepoContext,
  generateGithubScenarios,
  parseGithubRepoUrl,
  requestScenariosFromGemini,
} from "../src/lib/projects/scenario-generation.server.ts";

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

describe("parseGithubRepoUrl", () => {
  test("accepts owner/repo, github.com URLs, and .git suffixes", () => {
    assert.deepEqual(parseGithubRepoUrl("acme/widgets"), { owner: "acme", repo: "widgets" });
    assert.deepEqual(parseGithubRepoUrl("github.com/acme/widgets"), {
      owner: "acme",
      repo: "widgets",
    });
    assert.deepEqual(parseGithubRepoUrl("https://github.com/acme/widgets"), {
      owner: "acme",
      repo: "widgets",
    });
    assert.deepEqual(parseGithubRepoUrl("https://github.com/acme/widgets.git"), {
      owner: "acme",
      repo: "widgets",
    });
    assert.deepEqual(parseGithubRepoUrl("https://github.com/acme/widgets/"), {
      owner: "acme",
      repo: "widgets",
    });
  });

  test("rejects input with no owner/repo shape", () => {
    assert.equal(parseGithubRepoUrl("not-a-repo-url"), null);
    assert.equal(parseGithubRepoUrl(""), null);
  });
});

describe("fetchGithubRepoContext", () => {
  test("pulls default branch, description, filtered tree, and decoded README", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/repos/acme/widgets")) {
        return jsonResponse({ default_branch: "main", description: "Widget factory app" });
      }
      if (url.includes("/git/trees/main")) {
        return jsonResponse({
          tree: [
            { path: "src/index.ts", type: "blob" },
            { path: "node_modules/foo/index.js", type: "blob" },
            { path: "package-lock.json", type: "blob" },
            { path: "src", type: "tree" },
          ],
        });
      }
      if (url.endsWith("/readme")) {
        return jsonResponse({
          content: Buffer.from("# Widgets\nMakes widgets.").toString("base64"),
          encoding: "base64",
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const context = await fetchGithubRepoContext({ owner: "acme", repo: "widgets" });

    assert.equal(context.defaultBranch, "main");
    assert.equal(context.description, "Widget factory app");
    // node_modules and lockfiles are filtered out; the tree entry (not a blob) is too.
    assert.deepEqual(context.filePaths, ["src/index.ts"]);
    assert.equal(context.readme, "# Widgets\nMakes widgets.");
    assert.equal(calls.length, 3);
  });

  test("throws when the repo itself can't be found", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ message: "Not Found" }, { status: 404 })) as typeof fetch;

    await assert.rejects(
      () => fetchGithubRepoContext({ owner: "acme", repo: "missing" }),
      /GitHub API could not find acme\/missing/,
    );
  });
});

describe("buildScenarioPrompt", () => {
  test("grounds the prompt in the repo's real name, tree, and README", () => {
    const prompt = buildScenarioPrompt(
      { owner: "acme", repo: "widgets" },
      {
        description: "Widget factory app",
        defaultBranch: "main",
        filePaths: ["src/checkout.ts"],
        readme: "Makes widgets.",
      },
    );
    assert.match(prompt, /acme\/widgets/);
    assert.match(prompt, /Widget factory app/);
    assert.match(prompt, /src\/checkout\.ts/);
    assert.match(prompt, /Makes widgets\./);
    assert.match(prompt, /"scenarios"/);
  });
});

describe("requestScenariosFromGemini", () => {
  test("parses and validates Gemini's JSON response into scenario templates", async () => {
    const scenarios = [
      {
        type: "E2E",
        title: "Checkout completes with a valid cart",
        description: "A shopper adds an item and completes checkout.",
        priority: "critical",
        filePath: "tests/e2e/checkout.spec.ts",
      },
    ];
    globalThis.fetch = (async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ scenarios }) }] } }],
      })) as typeof fetch;

    const result = await requestScenariosFromGemini("some prompt");
    assert.deepEqual(result, scenarios);
  });

  test("throws when GOOGLE_API_KEY is missing", async () => {
    delete process.env["GOOGLE_API_KEY"];
    await assert.rejects(
      () => requestScenariosFromGemini("prompt"),
      /GOOGLE_API_KEY is not configured/,
    );
  });

  test("throws when Gemini's response doesn't match the expected shape", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: JSON.stringify({ scenarios: [{ oops: true }] }) }] } },
        ],
      })) as typeof fetch;

    await assert.rejects(
      () => requestScenariosFromGemini("prompt"),
      /did not match the expected scenario shape/,
    );
  });

  test("throws when Gemini returns non-JSON text", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "not json" }] } }],
      })) as typeof fetch;

    await assert.rejects(() => requestScenariosFromGemini("prompt"), /did not return valid JSON/);
  });
});

describe("generateGithubScenarios", () => {
  test("wires repo context into the Gemini prompt end to end", async () => {
    const scenarios = [
      {
        type: "API",
        title: "Rejects malformed checkout payloads",
        description: "POST /checkout with a missing cart id returns 400.",
        priority: "high",
        filePath: "tests/api/checkout-validation.spec.ts",
      },
    ];
    let capturedPrompt = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/widgets")) {
        return jsonResponse({ default_branch: "main", description: "Widget factory app" });
      }
      if (url.includes("/git/trees/main")) {
        return jsonResponse({ tree: [{ path: "src/checkout.ts", type: "blob" }] });
      }
      if (url.endsWith("/readme")) {
        return jsonResponse({
          content: Buffer.from("Sells widgets online.").toString("base64"),
          encoding: "base64",
        });
      }
      if (url.includes("generativelanguage.googleapis.com")) {
        capturedPrompt = JSON.parse(String(init?.body)).contents[0].parts[0].text;
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ scenarios }) }] } }],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await generateGithubScenarios("https://github.com/acme/widgets");

    assert.deepEqual(result, scenarios);
    assert.match(capturedPrompt, /acme\/widgets/);
    assert.match(capturedPrompt, /Sells widgets online\./);
  });

  test("throws (for the caller to fall back) when the source URL isn't a GitHub repo", async () => {
    await assert.rejects(
      () => generateGithubScenarios("not-a-repo"),
      /Could not parse a GitHub owner\/repo/,
    );
  });
});
