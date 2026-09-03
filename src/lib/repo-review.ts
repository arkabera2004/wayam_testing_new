import "server-only";

/**
 * Reviews imported source with fixed rules.
 *
 * Every rule below is a pattern that is checkable by reading one line, and
 * each finding says which file and line it came from so it can be verified in
 * seconds. Nothing here is a judgement about design or intent, because that
 * needs a reader. A clean result means these particular patterns were absent,
 * not that the code is good.
 */

export type ReviewFinding = {
  file: string;
  line: number;
  severity: "critical" | "high" | "medium" | "low";
  category: "security" | "bug" | "performance" | "style" | "test-coverage" | "maintainability";
  title: string;
  body: string;
  suggestion: string;
};

type Rule = {
  pattern: RegExp;
  applies?: RegExp;
  severity: ReviewFinding["severity"];
  category: ReviewFinding["category"];
  title: string;
  body: string;
  suggestion: string;
  /** Lines that look like the rule but are not, e.g. a comment about it. */
  unless?: RegExp;
};

const RULES: Rule[] = [
  {
    pattern: /(password|secret|api_?key|token)\s*[:=]\s*["'][^"']{8,}["']/i,
    unless: /process\.env|getenv|Environment\.|config\.|例|placeholder|xxx|your[-_]?key/i,
    severity: "critical",
    category: "security",
    title: "Credential written into the source",
    body: "A password, key or token appears as a literal. Anyone with the repository has it, and rotating it means a code change.",
    suggestion: "Read it from the environment and keep the value out of version control.",
  },
  {
    pattern: /console\.log\([^)]*\b(password|token|secret|req\.body|request\.body)\b/i,
    severity: "critical",
    category: "security",
    title: "Secret or request body written to the log",
    body: "Logging the whole body or a credential puts it into log storage, where it usually lives far longer and is read by more people than the request itself.",
    suggestion: "Log an identifier instead of the payload.",
  },
  {
    pattern: /(SELECT|INSERT|UPDATE|DELETE)\s+[^;'"]*["'`]\s*\+|\$\{[^}]+\}\s*(?:WHERE|VALUES)/i,
    unless: /\?\?|prepared|parameteri[sz]ed/i,
    severity: "critical",
    category: "security",
    title: "SQL built by joining strings",
    body: "A query assembled from concatenation or interpolation lets any value that reaches it change the statement.",
    suggestion: "Use parameters and let the driver escape the values.",
  },
  {
    pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=|v-html\s*=/,
    severity: "high",
    category: "security",
    title: "HTML injected without escaping",
    body: "Assigning raw HTML executes whatever markup the value contains. If any part of it came from a user, this is where a script gets in.",
    suggestion: "Render as text, or sanitise before assigning.",
  },
  {
    pattern: /\[ValidateAntiForgeryToken\]/,
    applies: /Controller\.cs$/i,
    severity: "low",
    category: "security",
    title: "Anti-forgery token validated",
    body: "This action checks the anti-forgery token.",
    suggestion: "No change needed. Listed so the absence elsewhere is visible.",
  },
  {
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: "high",
    category: "bug",
    title: "Error swallowed silently",
    body: "An empty catch discards the failure, so the code continues as if it worked and the cause is invisible when something later goes wrong.",
    suggestion: "Log it, or let it propagate to a handler that can act.",
  },
  {
    pattern: /\bTODO\b|\bFIXME\b|\bHACK\b/,
    severity: "low",
    category: "maintainability",
    title: "Unfinished work marked in the code",
    body: "A marker left in the source. Worth reading before release, since these usually outlive the moment that caused them.",
    suggestion: "Resolve it or move it somewhere it will be seen.",
  },
  {
    pattern: /==\s*(null|undefined)|!=\s*(null|undefined)/,
    applies: /\.(tsx?|jsx?)$/,
    unless: /===|!==/,
    severity: "low",
    category: "style",
    title: "Loose equality against null",
    body: "Loose comparison treats null and undefined as equal, which is sometimes wanted and often not. Which was meant here is not obvious from the line.",
    suggestion: "Use === and say which case is meant.",
  },
  {
    pattern: /\.then\([^)]*\)(?!\s*\.catch)/,
    applies: /\.(tsx?|jsx?)$/,
    unless: /\.catch|await|void /,
    severity: "medium",
    category: "bug",
    title: "Promise without a rejection handler",
    body: "A promise chain with no catch turns a rejection into an unhandled error, which in some runtimes ends the process.",
    suggestion: "Add a catch, or await it inside a try.",
  },
];

const REVIEWABLE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|rb|go|java|kt|php|cs|cshtml|razor)$/i;

export function reviewRepoFiles(
  files: Array<{ path: string; content: string | null }>,
): { findings: ReviewFinding[]; filesReviewed: number } {
  const findings: ReviewFinding[] = [];
  let reviewed = 0;

  for (const file of files) {
    if (!file.content || !REVIEWABLE.test(file.path)) continue;
    reviewed += 1;

    const lines = file.content.split("\n");
    lines.forEach((line, index) => {
      // Skip comment-only lines: a rule name discussed in prose is not a defect.
      if (/^\s*(\/\/|#|\*|<!--)/.test(line)) return;

      for (const rule of RULES) {
        if (rule.applies && !rule.applies.test(file.path)) continue;
        if (rule.unless && rule.unless.test(line)) continue;
        if (!rule.pattern.test(line)) continue;

        findings.push({
          file: file.path,
          line: index + 1,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          body: `${rule.body}\n\nLine ${index + 1}: \`${line.trim().slice(0, 160)}\``,
          suggestion: rule.suggestion,
        });
      }
    });
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  // One review should not drown the reader; the worst are the ones that matter.
  return { findings: findings.slice(0, 60), filesReviewed: reviewed };
}
