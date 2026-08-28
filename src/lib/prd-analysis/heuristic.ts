// Pure heuristic fallback for PRD Analysis, used when Gemini is
// unavailable — same "never block the feature" philosophy as
// scenario-generation.server.ts and doc-tests/heuristic.ts. Extracts
// numbered/bulleted requirements out of pasted PRD text, classifies each
// (functional / non-functional / security), flags the ones that can't be
// tested as written (vague wording, missing thresholds, duplicates), and
// drafts a traced test case for every testable one — see
// tests/prd-analysis.test.ts.
export type RequirementCategory = "functional" | "non-functional" | "security";
export type RequirementCoverage = "covered" | "partial" | "gap";
export type ScenarioTag = "happy-path" | "edge-case" | "negative";

export interface ExtractedRequirement {
  id: string; // "REQ-1"
  text: string;
  category: RequirementCategory;
  coverage: RequirementCoverage;
  issue: string | null;
}

export interface DraftTestCase {
  requirementId: string;
  title: string;
  description: string;
  type: "E2E" | "API" | "Regression" | "Accessibility" | "Visual";
  priority: "critical" | "high" | "medium" | "low";
  tag: ScenarioTag;
  filePath: string;
}

const SECURITY_KEYWORDS = [
  "password",
  "auth",
  "token",
  "encrypt",
  "pii",
  "permission",
  "access control",
  "credential",
  "gdpr",
  "pci",
];
const NON_FUNCTIONAL_KEYWORDS = [
  "response time",
  "throughput",
  "uptime",
  "page load",
  "load time",
  "under load",
  "latency",
  "performance",
  "scalab",
  "concurrent",
  "availability",
  "median connection",
];
const VAGUE_WORDS = [
  "quickly",
  "quick",
  "fast",
  "reasonably",
  "reasonable",
  "appropriate",
  "user-friendly",
  "intuitive",
  "efficient",
  "robust",
  "seamless",
  "as needed",
  "easy",
  "most users",
];
const API_KEYWORDS = ["endpoint", "api", "response", "status code", "payload", "request"];
const NEGATIVE_KEYWORDS = ["not", "invalid", "reject", "cannot", "must not", "error", "fails"];
const EDGE_KEYWORDS = [
  "edge",
  "boundary",
  "empty",
  "maximum",
  "minimum",
  "zero",
  "expired",
  "limit",
];

function classifyCategory(text: string): RequirementCategory {
  const lower = text.toLowerCase();
  if (SECURITY_KEYWORDS.some((k) => lower.includes(k))) return "security";
  if (NON_FUNCTIONAL_KEYWORDS.some((k) => lower.includes(k))) return "non-functional";
  return "functional";
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const setB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

const DUPLICATE_THRESHOLD = 0.6;

/** Splits pasted PRD text into individual requirement statements. Prefers
 * numbered ("1. ...") or bulleted ("- ...") lines, since that's how most
 * PRDs actually list requirements; falls back to sentence splitting (same
 * approach as doc-tests/heuristic.ts) when neither pattern is present. */
export function splitRequirements(docText: string): string[] {
  const lines = docText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const numbered = lines
    .map((l) => l.match(/^(?:\d+[.)]|[-*])\s+(.+)/)?.[1])
    .filter((l): l is string => Boolean(l && l.length > 5));
  if (numbered.length >= 2) return numbered;

  return docText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 400);
}

export function classifyRequirements(rawRequirements: string[]): ExtractedRequirement[] {
  const results: ExtractedRequirement[] = [];

  rawRequirements.forEach((text, i) => {
    const id = `REQ-${i + 1}`;
    const category = classifyCategory(text);
    const lower = text.toLowerCase();

    const duplicateOf = results.find((r) => jaccardSimilarity(r.text, text) >= DUPLICATE_THRESHOLD);
    const vagueWord = VAGUE_WORDS.find((w) => lower.includes(w));
    const hasNumber = /\d/.test(text);

    let coverage: RequirementCoverage;
    let issue: string | null;
    if (duplicateOf) {
      coverage = "partial";
      issue = `Duplicates ${duplicateOf.id}, which is measurable. Recommend deleting or merging.`;
    } else if (vagueWord && !hasNumber) {
      coverage = "gap";
      issue = `Not testable as written. "${vagueWord}" has no measurable threshold.`;
    } else if (vagueWord) {
      coverage = "partial";
      issue = `Wording is loose ("${vagueWord}"); confirm the intended threshold before generating.`;
    } else {
      coverage = "covered";
      issue = null;
    }

    results.push({ id, text, category, coverage, issue });
  });

  return results;
}

function slugify(text: string, max = 40): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "requirement"
  );
}

/** Drafts one test case per testable requirement (coverage "covered" or
 * "partial" — "gap" requirements are excluded, matching how the app
 * treats a "Testable" count as lower than the raw requirement count). */
export function draftTestCases(requirements: ExtractedRequirement[]): DraftTestCase[] {
  return requirements
    .filter((r) => r.coverage !== "gap")
    .map((r) => {
      const lower = r.text.toLowerCase();
      const tag: ScenarioTag = NEGATIVE_KEYWORDS.some((k) => lower.includes(k))
        ? "negative"
        : EDGE_KEYWORDS.some((k) => lower.includes(k))
          ? "edge-case"
          : "happy-path";

      const type: DraftTestCase["type"] =
        r.category === "non-functional"
          ? "Regression"
          : API_KEYWORDS.some((k) => lower.includes(k))
            ? "API"
            : "E2E";

      const priority: DraftTestCase["priority"] =
        r.category === "security"
          ? "critical"
          : r.category === "non-functional"
            ? "high"
            : tag === "negative"
              ? "high"
              : "medium";

      return {
        requirementId: r.id,
        title: r.text.length > 80 ? `${r.text.slice(0, 77)}...` : r.text,
        description: `Traced to ${r.id}: "${r.text}"`,
        type,
        priority,
        tag,
        filePath: `tests/prd/${slugify(r.id + "-" + r.text)}.spec.ts`,
      };
    });
}
