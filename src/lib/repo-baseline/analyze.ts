// Pure repo-baseline analysis (ported from aidlc_azure's RepoBaseline
// page), kept separate from the GitHub-fetching orchestration — see
// tests/repo-baseline.test.ts. Given a repo's file tree + README, reports
// a structural snapshot: language breakdown, test-file presence, CI config
// presence, and README length — useful context before drafting a test
// plan for a repo nobody's described to Parikshan yet.
const TEST_PATH_PATTERN = /(^|\/)(tests?|specs?|__tests__)\//i;
const TEST_FILENAME_PATTERN = /\.(spec|test)\.[a-z]+$/i;
const CI_CONFIG_PATTERN = /^\.github\/workflows\//i;

const KNOWN_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "go",
  "rs",
  "java",
  "rb",
  "php",
  "c",
  "cpp",
  "cs",
  "swift",
  "kt",
]);

export interface LanguageBreakdown {
  extension: string;
  fileCount: number;
  pct: number;
}

export interface RepoBaselineReport {
  totalFiles: number;
  languages: LanguageBreakdown[];
  testFileCount: number;
  hasCiConfig: boolean;
  readmeLength: number;
  hasReadme: boolean;
}

function extensionOf(path: string): string | null {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  if (dot === -1) return null;
  return base.slice(dot + 1).toLowerCase();
}

function isTestFile(path: string): boolean {
  return TEST_PATH_PATTERN.test(path) || TEST_FILENAME_PATTERN.test(path);
}

export function analyzeRepoBaseline(
  filePaths: string[],
  readme: string | null,
): RepoBaselineReport {
  const languageCounts = new Map<string, number>();
  let testFileCount = 0;
  let hasCiConfig = false;

  for (const path of filePaths) {
    if (isTestFile(path)) testFileCount += 1;
    if (CI_CONFIG_PATTERN.test(path)) hasCiConfig = true;

    const ext = extensionOf(path);
    if (ext && KNOWN_EXTENSIONS.has(ext)) {
      languageCounts.set(ext, (languageCounts.get(ext) ?? 0) + 1);
    }
  }

  const totalKnownFiles = Array.from(languageCounts.values()).reduce((a, b) => a + b, 0);
  const languages: LanguageBreakdown[] = Array.from(languageCounts.entries())
    .map(([extension, fileCount]) => ({
      extension,
      fileCount,
      pct: totalKnownFiles === 0 ? 0 : Math.round((fileCount / totalKnownFiles) * 100),
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  return {
    totalFiles: filePaths.length,
    languages,
    testFileCount,
    hasCiConfig,
    readmeLength: readme?.length ?? 0,
    hasReadme: Boolean(readme),
  };
}
