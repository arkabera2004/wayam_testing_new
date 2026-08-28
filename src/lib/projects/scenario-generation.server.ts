// Real pipeline for GitHub-repo scenario generation, replacing the
// starterScenarios() stub in ./functions.ts for sourceType "github": fetch
// the repo's real file tree + README from the GitHub API, then ask Gemini
// to draft test scenarios tailored to what the repo actually contains.
//
// Kept dependency-free of MongoDB/collections on purpose (network + a pure
// prompt builder + response validation only) so tests/scenario-generation.test.ts
// can exercise it directly with a mocked `fetch`, the same way
// tests/org-isolation.test.ts exercises org-access.server.ts directly — see
// that file's header comment for why relative imports are used here too.
import { z } from "zod";

import type { ScenarioPriority, ScenarioType } from "../../integrations/mongodb/schema.ts";

export interface ScenarioTemplate {
  type: ScenarioType;
  title: string;
  description: string;
  priority: ScenarioPriority;
  filePath: string | null;
}

const MAX_TREE_ENTRIES = 250;
const MAX_README_CHARS = 6000;

// Paths that add noise to the prompt without telling an LLM anything about
// what the app *does* — dependency trees, build output, lockfiles, binary
// assets.
const NOISE_PATH_PATTERN = /(^|\/)(node_modules|dist|build|\.git|vendor|coverage)\//i;
const NOISE_EXTENSION_PATTERN = /\.(lock|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|pdf|zip)$/i;
const NOISE_BASENAME_PATTERN =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Gemfile\.lock|Cargo\.lock)$/i;

function isNoisePath(path: string): boolean {
  return (
    NOISE_PATH_PATTERN.test(path) ||
    NOISE_EXTENSION_PATTERN.test(path) ||
    NOISE_BASENAME_PATTERN.test(path)
  );
}

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

/** Accepts "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo",
 * and "https://github.com/owner/repo.git" (with or without a trailing slash). */
export function parseGithubRepoUrl(input: string): GithubRepoRef | null {
  const trimmed = input
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const match = trimmed.match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)$/);
  if (!match) return null;
  const [, owner, repo] = match;
  if (!owner || !repo) return null;
  return { owner, repo };
}

export interface GithubRepoContext {
  description: string | null;
  defaultBranch: string;
  filePaths: string[];
  readme: string | null;
}

function githubHeaders(): HeadersInit {
  const token = process.env["GITHUB_TOKEN"];
  return {
    accept: "application/vnd.github+json",
    "user-agent": "parikshan-scenario-generation",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/** Fetches just enough real repo context to ground scenario generation: the
 * default branch + description, a filtered file tree, and the README. Best
 * effort on the tree/README (a repo with no README, or one whose tree call
 * fails, still gets scenarios — just from less context) but throws if the
 * repo itself can't be found, since there's nothing to generate from then. */
export async function fetchGithubRepoContext(ref: GithubRepoRef): Promise<GithubRepoContext> {
  const repoRes = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, {
    headers: githubHeaders(),
  });
  if (!repoRes.ok) {
    throw new Error(
      `GitHub API could not find ${ref.owner}/${ref.repo} (${repoRes.status}) — check the repo URL and, for private repos, GITHUB_TOKEN`,
    );
  }
  const repoBody = (await repoRes.json()) as {
    default_branch: string;
    description: string | null;
  };

  const filePaths: string[] = [];
  const treeRes = await fetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${repoBody.default_branch}?recursive=1`,
    { headers: githubHeaders() },
  );
  if (treeRes.ok) {
    const treeBody = (await treeRes.json()) as { tree: Array<{ path: string; type: string }> };
    for (const entry of treeBody.tree) {
      if (entry.type !== "blob" || isNoisePath(entry.path)) continue;
      filePaths.push(entry.path);
      if (filePaths.length >= MAX_TREE_ENTRIES) break;
    }
  }

  let readme: string | null = null;
  const readmeRes = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/readme`, {
    headers: githubHeaders(),
  });
  if (readmeRes.ok) {
    const readmeBody = (await readmeRes.json()) as { content: string; encoding: string };
    if (readmeBody.encoding === "base64") {
      readme = Buffer.from(readmeBody.content, "base64")
        .toString("utf-8")
        .slice(0, MAX_README_CHARS);
    }
  }

  return {
    description: repoBody.description,
    defaultBranch: repoBody.default_branch,
    filePaths,
    readme,
  };
}

export function buildScenarioPrompt(ref: GithubRepoRef, context: GithubRepoContext): string {
  const treeListing = context.filePaths.join("\n") || "(no file listing available)";
  return `You are a senior QA engineer drafting a test plan for the GitHub repository ${ref.owner}/${ref.repo}.
${context.description ? `Repository description: ${context.description}` : "No repository description available."}

Partial file listing (up to ${MAX_TREE_ENTRIES} paths, gives you the repo's real structure):
${treeListing}

README${context.readme ? "" : " (none found)"}:
${context.readme ?? "(no README found)"}

Propose between 4 and 8 concrete, specific test scenarios worth automating for THIS repository —
reference actual features, routes, endpoints, or modules you can infer from the file listing and
README above. Do not propose generic placeholder scenarios that could apply to any app. Cover a
mix of scenario types where the repo's structure actually supports them: E2E, API, Regression,
Accessibility, Visual.

Respond with ONLY JSON (no markdown fences, no commentary) matching exactly this shape:
{
  "scenarios": [
    {
      "type": "E2E" | "API" | "Regression" | "Accessibility" | "Visual",
      "title": string,
      "description": string,
      "priority": "critical" | "high" | "medium" | "low",
      "filePath": string
    }
  ]
}`;
}

const scenarioSchema = z.object({
  type: z.enum(["E2E", "API", "Regression", "Accessibility", "Visual"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  priority: z.enum(["critical", "high", "medium", "low"]),
  filePath: z.string().trim().min(1).max(300),
});

const geminiResponseSchema = z.object({
  scenarios: z.array(scenarioSchema).min(1).max(12),
});

// "gemini-flash-latest" (-> gemini-3.7-flash) has a 20-requests/day free-tier
// quota that's easy to exhaust during development (see the crawl-agent
// service's own README for the same constraint). The lite alias carries a
// separate, much larger free-tier daily quota and is more than capable for
// this bounded-output JSON task, so it's the default here.
const GEMINI_MODEL = "gemini-flash-lite-latest";

/** Calls Gemini with a prompt already grounded in real repo context and
 * validates the response against the same shape starterScenarios() used to
 * hand-write, so nothing downstream (insertion, the scenario review UI)
 * needs to change. Kept as its own function (rather than inlined into
 * generateGithubScenarios) so tests can mock just the LLM half of the
 * pipeline. */
export async function requestScenariosFromGemini(prompt: string): Promise<ScenarioTemplate[]> {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini request failed (${res.status})`);
  }

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error("Gemini did not return valid JSON");
  }

  const result = geminiResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `Gemini response did not match the expected scenario shape: ${result.error.message}`,
    );
  }

  return result.data.scenarios;
}

/** The real GitHub-repo scenario-generation pipeline: parse the repo out of
 * the source URL, pull its real file tree + README, and hand that context
 * to Gemini. Called from createProjectFn (src/lib/projects/functions.ts)
 * for sourceType "github" — that's where auth/org-scoping/Zod validation
 * already live, so this stays a plain function rather than its own
 * createServerFn. */
export async function generateGithubScenarios(sourceUrl: string): Promise<ScenarioTemplate[]> {
  const ref = parseGithubRepoUrl(sourceUrl);
  if (!ref) {
    throw new Error(`Could not parse a GitHub owner/repo out of "${sourceUrl}"`);
  }

  const context = await fetchGithubRepoContext(ref);
  const prompt = buildScenarioPrompt(ref, context);
  return await requestScenariosFromGemini(prompt);
}
