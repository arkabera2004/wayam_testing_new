// Pure defect-risk scoring (ported from aidlc_azure's DefectPrediction
// page/defect_prediction route's per-file commit-history analysis), kept
// separate from the GitHub-fetching orchestration — see
// tests/defect-prediction.test.ts.
const BUG_KEYWORDS = [
  "fix",
  "bug",
  "hotfix",
  "patch",
  "defect",
  "issue",
  "error",
  "crash",
  "regression",
  "revert",
];

export function isBugFixMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return BUG_KEYWORDS.some((k) => lower.includes(k));
}

export interface CommitFileChange {
  filename: string;
  additions: number;
  deletions: number;
}

export interface CommitInput {
  message: string;
  author: string | null;
  files: CommitFileChange[];
}

export interface FileRisk {
  filename: string;
  changeCount: number;
  bugFixCount: number;
  authorCount: number;
  churn: number;
  riskScore: number;
}

/** Scores each touched file 0-100: half the weight is how often its
 * changes were bug fixes (this file breaks often), the other half is
 * change frequency relative to the busiest file in this commit range
 * (this file is a hotspot). Returns the top `limit` riskiest files. */
export function computeDefectRisk(commits: CommitInput[], limit = 20): FileRisk[] {
  const byFile = new Map<
    string,
    { changeCount: number; bugFixCount: number; authors: Set<string>; churn: number }
  >();

  for (const commit of commits) {
    const isBugFix = isBugFixMessage(commit.message);
    for (const file of commit.files) {
      const entry = byFile.get(file.filename) ?? {
        changeCount: 0,
        bugFixCount: 0,
        authors: new Set<string>(),
        churn: 0,
      };
      entry.changeCount += 1;
      if (isBugFix) entry.bugFixCount += 1;
      if (commit.author) entry.authors.add(commit.author);
      entry.churn += file.additions + file.deletions;
      byFile.set(file.filename, entry);
    }
  }

  const maxChangeCount = Math.max(1, ...Array.from(byFile.values()).map((f) => f.changeCount));

  const risks: FileRisk[] = Array.from(byFile.entries()).map(([filename, stats]) => {
    const bugFixRatio = stats.changeCount === 0 ? 0 : stats.bugFixCount / stats.changeCount;
    const frequencyRatio = stats.changeCount / maxChangeCount;
    const riskScore = Math.round(bugFixRatio * 60 + frequencyRatio * 40);
    return {
      filename,
      changeCount: stats.changeCount,
      bugFixCount: stats.bugFixCount,
      authorCount: stats.authors.size,
      churn: stats.churn,
      riskScore,
    };
  });

  return risks.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}
