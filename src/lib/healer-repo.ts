import "server-only";

import type { HealCandidate } from "./healer";

/**
 * Heals a selector by reading the repository instead of a running page.
 *
 * The live healer needs somewhere to point a browser. Most projects here are
 * imported source with nothing deployed, so a broken locator had no way to be
 * repaired at all. The markup that a page will render is in the source, so the
 * candidates can be read straight out of it.
 *
 * This sees what the source declares, not what the browser ends up with, so it
 * cannot know about anything composed at runtime. Its confidence is capped
 * below the live healer's for that reason, and every candidate says which file
 * and line it came from so a human can check.
 */

export type RepoFile = { path: string; content: string | null };

export type RepoHealCandidate = HealCandidate & { file: string; line: number };

/** Only files that can contain markup are worth scanning. */
const MARKUP = /\.(tsx?|jsx?|vue|svelte|html?|cshtml|razor|erb|php)$/i;

type Extracted = { value: string; strategy: HealCandidate["strategy"]; selector: string; role: string | null };

/** Reads the identifying attributes and text a locator could target. */
function extractFromLine(line: string): Extracted[] {
  const out: Extracted[] = [];

  const tag = line.match(/<\s*([A-Za-z][\w-]*)/)?.[1]?.toLowerCase() ?? null;
  const roleAttr = line.match(/\brole\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
  const role =
    roleAttr ??
    (tag === "button" || /type\s*=\s*["']submit["']/.test(line)
      ? "button"
      : tag === "a"
        ? "link"
        : tag === "input" || tag === "textarea"
          ? "textbox"
          : null);

  for (const m of line.matchAll(/\bdata-testid\s*=\s*["']([^"']+)["']/g)) {
    out.push({ value: m[1], strategy: "test-id", selector: `[data-testid="${m[1]}"]`, role });
  }
  for (const m of line.matchAll(/\baria-label\s*=\s*["']([^"']+)["']/g)) {
    out.push({ value: m[1], strategy: "label", selector: `getByLabel(${JSON.stringify(m[1])})`, role });
  }
  for (const m of line.matchAll(/\bid\s*=\s*["']([^"'{}]+)["']/g)) {
    out.push({ value: m[1], strategy: "test-id", selector: `#${m[1]}`, role });
  }
  // Text between tags, which is what a role+name or text locator matches.
  for (const m of line.matchAll(/>\s*([A-Za-z][^<>{}\n]{1,48}?)\s*</g)) {
    const text = m[1].trim();
    if (!text || /^[\s|·-]+$/.test(text)) continue;
    out.push({
      value: text,
      strategy: role ? "role-name" : "text",
      selector: role ? `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(text)} })` : `text=${text}`,
      role,
    });
  }

  return out;
}

/** Words a locator is really about, with the plumbing stripped out. */
function terms(selector: string): string[] {
  return selector
    .replace(/getBy\w+|data-testid|aria-label|\bname\b|role|text|css|xpath/gi, " ")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 2);
}

/** What kind of thing the broken selector was pointing at, if it says. */
function impliedRole(selector: string): string | null {
  const s = selector.toLowerCase();
  if (/\bbtn\b|button|submit|cta/.test(s)) return "button";
  if (/\blink\b|anchor|nav/.test(s)) return "link";
  if (/input|field|textbox|search-?box/.test(s)) return "textbox";
  return null;
}

function similarity(broken: string, candidateValue: string): number {
  const a = new Set(terms(broken));
  const b = new Set(terms(candidateValue));
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  // Jaccard, so a long candidate does not win just by containing more words.
  const union = new Set([...a, ...b]).size;
  return Math.round((shared / union) * 100);
}

const STRATEGY_RANK: Record<HealCandidate["strategy"], number> = {
  "test-id": 3,
  label: 2,
  "role-name": 1,
  text: 0,
};

/** Source can only suggest, never confirm, so it never reports certainty. */
const CONFIDENCE_CAP = 80;
const MIN_CONFIDENCE = 30;

export function healFromRepo(
  files: RepoFile[],
  brokenSelector: string,
): { healed: RepoHealCandidate | null; candidates: RepoHealCandidate[]; filesScanned: number } {
  const wanted = impliedRole(brokenSelector);
  const found: RepoHealCandidate[] = [];
  let scanned = 0;

  for (const file of files) {
    if (!file.content || !MARKUP.test(file.path)) continue;
    scanned += 1;

    const lines = file.content.split("\n");
    lines.forEach((line, index) => {
      for (const item of extractFromLine(line)) {
        // Never heal a button into a link: the kinds must agree when both say.
        if (wanted && item.role && item.role !== wanted) continue;

        const score = Math.min(similarity(brokenSelector, item.value), CONFIDENCE_CAP);
        if (score < MIN_CONFIDENCE) continue;

        found.push({
          selector: item.selector,
          strategy: item.strategy,
          similarity: score,
          reason: `Found in ${file.path}:${index + 1} as ${item.strategy.replace("-", " ")} "${item.value}".`,
          file: file.path,
          line: index + 1,
        });
      }
    });
  }

  // Same selector can appear in several files; keep the strongest of each.
  const best = new Map<string, RepoHealCandidate>();
  for (const c of found) {
    const prev = best.get(c.selector);
    if (!prev || c.similarity > prev.similarity) best.set(c.selector, c);
  }

  const candidates = [...best.values()].sort(
    (a, b) => b.similarity - a.similarity || STRATEGY_RANK[b.strategy] - STRATEGY_RANK[a.strategy],
  );

  return { healed: candidates[0] ?? null, candidates: candidates.slice(0, 8), filesScanned: scanned };
}
