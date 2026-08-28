// Pure heuristic fallback for Doc Tests, used when Gemini is unavailable
// (no GOOGLE_API_KEY, rate limit, quota) — same "never block the feature"
// philosophy as scenario-generation.server.ts's fallback templates.
// Extracts sentences that read like testable requirements (contain a
// normative keyword: "must", "should", "returns", etc.) directly out of
// pasted documentation text — see tests/doc-tests.test.ts.
export interface ExtractedRequirement {
  sentence: string;
  keyword: string;
}

const REQUIREMENT_KEYWORDS = [
  "must not",
  "must",
  "should not",
  "should",
  "shall",
  "cannot",
  "returns an error",
  "returns a 4",
  "returns",
  "throws",
  "requires",
  "rejects",
];

/** Splits on sentence-ending punctuation, trims, and drops anything too
 * short/long to be a plausible single requirement. */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 300);
}

export function extractRequirements(docText: string, max = 8): ExtractedRequirement[] {
  const found: ExtractedRequirement[] = [];
  for (const sentence of splitSentences(docText)) {
    const lower = sentence.toLowerCase();
    const keyword = REQUIREMENT_KEYWORDS.find((k) => lower.includes(k));
    if (keyword) {
      found.push({ sentence, keyword });
      if (found.length >= max) break;
    }
  }
  return found;
}

export type DocScenarioType = "E2E" | "API" | "Regression" | "Accessibility" | "Visual";
export type DocScenarioPriority = "critical" | "high" | "medium" | "low";

export interface DocScenarioTemplate {
  title: string;
  description: string;
  type: DocScenarioType;
  priority: DocScenarioPriority;
  filePath: string | null;
}

function slugify(text: string, max = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

const RETURNS_OR_THROWS = /\b(returns|throws|rejects)\b/i;

/** Turns each extracted requirement into a draft scenario. Sentences about
 * what an API returns/throws/rejects are typed API; everything else (a
 * behavioral "must"/"should" statement) is typed E2E, since that's what a
 * doc's plain-language requirement usually describes. */
export function requirementsToScenarios(
  requirements: ExtractedRequirement[],
): DocScenarioTemplate[] {
  return requirements.map((req) => {
    const isApiLike = RETURNS_OR_THROWS.test(req.sentence);
    const slug = slugify(req.sentence) || "requirement";
    return {
      title: req.sentence.length > 80 ? `${req.sentence.slice(0, 77)}...` : req.sentence,
      description: `Documented requirement: "${req.sentence}"`,
      type: isApiLike ? "API" : "E2E",
      priority: "medium",
      filePath: isApiLike ? `tests/api/${slug}.spec.ts` : `tests/e2e/${slug}.spec.ts`,
    };
  });
}
