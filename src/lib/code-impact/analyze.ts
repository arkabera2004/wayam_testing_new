// Pure Code Impact analysis (ported from aidlc_azure's CodeImpact page),
// kept separate from Mongo plumbing — see tests/code-impact.test.ts.
//
// Reuses the same directory/filename-stem overlap signal as Intelligent
// Test Selection (see src/lib/shared/file-overlap.ts), but answers a
// different question per changed file: "what's the blast radius, and how
// risky is this specific file to touch?" — grouped by file rather than
// ranked as one flat test list.
import { filenameStem, pathSegments } from "../shared/file-overlap.ts";

export interface ImpactCandidate {
  testCaseId: string;
  scenarioTitle: string;
  scenarioType: string;
  priority: string;
  filePath: string | null;
}

export type RiskTier = "high" | "medium" | "low" | "unknown";

export interface FileImpact {
  changedFile: string;
  affectedTests: Array<
    Pick<ImpactCandidate, "testCaseId" | "scenarioTitle" | "scenarioType" | "priority">
  >;
  riskTier: RiskTier;
}

export interface CodeImpactSummary {
  files: FileImpact[];
  totalAffectedTests: number;
  untestedFileCount: number;
  overallRiskTier: RiskTier;
}

const RISK_RANK: Record<RiskTier, number> = { unknown: 3, high: 2, medium: 1, low: 0 };

function riskTierForCandidates(candidates: ImpactCandidate[]): RiskTier {
  if (candidates.length === 0) return "unknown";
  if (candidates.some((c) => c.priority === "critical" || c.priority === "high")) return "high";
  if (candidates.some((c) => c.priority === "medium")) return "medium";
  return "low";
}

function overlaps(changedFile: string, candidate: ImpactCandidate): boolean {
  if (!candidate.filePath) return false;
  const changeDirs = new Set(pathSegments(changedFile).slice(0, -1));
  const testDirs = new Set(pathSegments(candidate.filePath).slice(0, -1));
  const stemMatch = filenameStem(changedFile) === filenameStem(candidate.filePath);
  const dirMatch = [...changeDirs].some((seg) => testDirs.has(seg));
  return stemMatch || dirMatch;
}

/** Analyzes each changed file independently — a file that maps to no test
 * case at all is flagged "unknown" risk (untested surface, worth a human
 * look) rather than silently treated as safe. */
export function analyzeCodeImpact(
  changedFiles: string[],
  candidates: ImpactCandidate[],
): CodeImpactSummary {
  const cleaned = changedFiles.map((f) => f.trim()).filter(Boolean);

  const files: FileImpact[] = cleaned.map((changedFile) => {
    const affected = candidates.filter((c) => overlaps(changedFile, c));
    return {
      changedFile,
      affectedTests: affected.map(({ testCaseId, scenarioTitle, scenarioType, priority }) => ({
        testCaseId,
        scenarioTitle,
        scenarioType,
        priority,
      })),
      riskTier: riskTierForCandidates(affected),
    };
  });

  const affectedTestIds = new Set(files.flatMap((f) => f.affectedTests.map((t) => t.testCaseId)));
  const untestedFileCount = files.filter((f) => f.affectedTests.length === 0).length;
  const overallRiskTier = files.reduce<RiskTier>(
    (worst, f) => (RISK_RANK[f.riskTier] > RISK_RANK[worst] ? f.riskTier : worst),
    "low",
  );

  return {
    files,
    totalAffectedTests: affectedTestIds.size,
    untestedFileCount,
    overallRiskTier: files.length === 0 ? "unknown" : overallRiskTier,
  };
}
