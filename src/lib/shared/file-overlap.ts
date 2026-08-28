// Shared path-matching helpers used by both Intelligent Test Selection
// (src/lib/test-selection/scoring.ts) and Code Impact
// (src/lib/code-impact/analyze.ts) to relate a changed file to a test
// case's own file path.
export function pathSegments(path: string): string[] {
  return path
    .split(/[/\\]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function filenameStem(path: string): string {
  const base = pathSegments(path).at(-1) ?? path;
  // Strip everything from the first dot on, not just the last extension,
  // so "checkout.spec.ts" and "checkout.ts" both stem to "checkout".
  return base.slice(0, base.indexOf(".") === -1 ? undefined : base.indexOf(".")).toLowerCase();
}
