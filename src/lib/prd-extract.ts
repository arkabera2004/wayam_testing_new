import "server-only";

import { REQUIREMENT_KIND, REQUIREMENT_PRIORITY } from "@/db/schema";

/**
 * Pulls requirements out of a document.
 *
 * Deliberately a parser, not a model. Everything it reports is traceable to a
 * span of the text the user supplied: a numbered clause, a bullet, or a
 * sentence carrying an obligation word. That means it under-reads a discursive
 * document rather than inventing structure that was never there, and when it
 * cannot find anything it says so instead of producing plausible filler.
 *
 * The classification below is keyword matching, and it is stated as such in
 * the UI. It is a starting point for a human to correct, not a judgement.
 */

export type ExtractedRequirement = {
  title: string;
  body: string;
  kind: (typeof REQUIREMENT_KIND)[number];
  priority: (typeof REQUIREMENT_PRIORITY)[number];
  /** Set when the clause cannot be tested as written. */
  ambiguity: string | null;
};

/** Obligation words. A line carrying one is stating a requirement. */
const OBLIGATION = /\b(must|shall|should|will|needs? to|has to|is required to|cannot|must not|should not)\b/i;

/** Leading list markers: "1.", "1)", "-", "*", "R1:", "REQ-3 -". */
const MARKER = /^\s*(?:(?:REQ[-\s]?\d+|R\d+)\s*[:.\-]\s*|\d+[\.\)]\s+|[-*•]\s+)/i;

/** Words that make a clause untestable as written. */
const VAGUE = [
  "fast", "quickly", "slow", "easy", "intuitive", "user-friendly", "simple",
  "appropriate", "reasonable", "sufficient", "adequate", "robust", "seamless",
  "efficient", "as needed", "etc", "and so on", "where possible", "if necessary",
];

function classify(text: string): (typeof REQUIREMENT_KIND)[number] {
  const t = text.toLowerCase();
  // Stems, not whole words: "encrypted", "authorisation" and "injection" all
  // have to match, so these deliberately run past a word boundary.
  if (/\b(auth\w*|password\w*|token\w*|permission\w*|role\w*|encrypt\w*|secur\w*|xss|csrf|inject\w*|login|sign-?in|session\w*|credential\w*)\b/.test(t)) {
    return "security";
  }
  if (/\b(screen ?reader\w*|aria|keyboard|contrast|accessib\w*|wcag|alt text|focus order)\b/.test(t)) {
    return "accessibility";
  }
  if (/\b(performance|perform\w*|latency|throughput|uptime|availab\w*|scal\w*|load|response time|concurrent\w*|ms\b|seconds?)\b/.test(t)) {
    return "non-functional";
  }
  return "functional";
}

function prioritise(text: string): (typeof REQUIREMENT_PRIORITY)[number] {
  const t = text.toLowerCase();
  // "must" and "shall" are the strong forms; "should" is a preference.
  if (/\b(must not|cannot|must|shall)\b/.test(t)) return "P0";
  if (/\b(should|needs? to|has to|is required to)\b/.test(t)) return "P1";
  return "P2";
}

function ambiguityOf(text: string): string | null {
  const hits = VAGUE.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
  if (hits.length === 0) return null;
  return `Not testable as written: "${hits.join('", "')}" ${
    hits.length === 1 ? "does" : "do"
  } not state a value anything could be checked against.`;
}

/** First sentence, trimmed to something that fits a list row. */
function titleOf(body: string): string {
  const firstSentence = body.split(/(?<=[.!?])\s/)[0] ?? body;
  const t = firstSentence.trim().replace(/\s+/g, " ");
  return t.length > 110 ? `${t.slice(0, 107).trimEnd()}...` : t;
}

/**
 * Splits a document into candidate clauses.
 *
 * A marked line (numbered or bulleted) is one clause even when it runs to
 * several sentences, because the author already decided where the boundary
 * was. Unmarked prose falls back to sentence splitting, which is coarser.
 */
function clauses(document: string): string[] {
  const lines = document.split(/\r?\n/);
  const out: string[] = [];
  let current: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      if (current) { out.push(current); current = null; }
      continue;
    }
    // A heading introduces clauses, it is not one itself.
    if (/^#{1,6}\s/.test(line)) {
      if (current) { out.push(current); current = null; }
      continue;
    }
    if (MARKER.test(line)) {
      if (current) out.push(current);
      current = line.replace(MARKER, "").trim();
      continue;
    }
    // A continuation of the clause above it.
    if (current) { current = `${current} ${line}`; continue; }
    out.push(line);
  }
  if (current) out.push(current);

  // Unmarked paragraphs may hold several requirements in a row.
  return out.flatMap((c) => (MARKER.test(c) ? [c] : c.split(/(?<=[.!?])\s+(?=[A-Z])/)))
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Everything in the document that states an obligation.
 *
 * Returns an empty array for a document that states none - a design note, a
 * summary, a page of prose - rather than promoting arbitrary sentences to
 * requirements so the screen has something on it.
 */
export function extractRequirements(document: string): ExtractedRequirement[] {
  const seen = new Set<string>();
  const found: ExtractedRequirement[] = [];

  for (const clause of clauses(document)) {
    if (clause.length < 12) continue;
    if (!OBLIGATION.test(clause)) continue;

    const key = clause.toLowerCase().replace(/\W+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);

    found.push({
      title: titleOf(clause),
      body: clause,
      kind: classify(clause),
      priority: prioritise(clause),
      ambiguity: ambiguityOf(clause),
    });
  }

  return found;
}
