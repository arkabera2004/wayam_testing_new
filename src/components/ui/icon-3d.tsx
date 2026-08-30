import { cn } from "./index";

/**
 * The rendered 3D icon set in public/brand/icons.
 *
 * Names describe the job, not the drawing, so a render can be swapped without
 * touching call sites. Sources and the prompts that produced them are in
 * prompts.md at the repo root.
 */
export const ICONS = {
  // Landing: how it works
  connect: "connect",
  explore: "explore",
  "review-plan": "review-plan",
  "self-heal": "self-heal",

  // Landing: capabilities
  ingestion: "ingestion",
  "human-approval": "human-approval",
  "readable-code": "readable-code",
  "parallel-runs": "parallel-runs",
  "healing-locators": "healing-locators",
  quarantine: "quarantine",

  // Discovery and map
  crawl: "crawl",
  "pages-found": "pages-found",
  journey: "journey",
  "network-capture": "network-capture",
  "auth-gated": "auth-gated",
  "api-inventory": "api-inventory",

  // PRD analysis
  "prd-extract": "prd-extract",
  "prd-classify": "prd-classify",
  "prd-ambiguity": "prd-ambiguity",
  "prd-traceability": "prd-traceability",
  "prd-untestable": "prd-untestable",
  "prd-generate": "prd-generate",

  // Tests and code
  "spec-file": "spec-file",
  "decision-fork": "decision-fork",
  "edge-case": "edge-case",
  "export-to-repo": "export-to-repo",

  // Runs
  "run-trigger": "run-trigger",
  "parallel-grid": "parallel-grid",
  duration: "duration",
  "gate-open": "gate-open",
  "gate-blocked": "gate-blocked",

  // Triage
  "screenshot-diff": "screenshot-diff",
  "video-replay": "video-replay",
  "network-trace": "network-trace",
  "root-cause": "root-cause",
  "failure-cluster": "failure-cluster",

  // Healing
  "selector-repair": "selector-repair",
  "locator-grip": "locator-grip",
  similarity: "similarity",
  "time-saved": "time-saved",

  // Analytics
  "coverage-trend": "coverage-trend",
  heatmap: "heatmap",
  "pass-rate": "pass-rate",
  "triage-time": "triage-time",

  // Integrations
  "ci-pipeline": "ci-pipeline",
  alerts: "alerts",
  "issue-filed": "issue-filed",
  "api-keys": "api-keys",

  // Empty states and onboarding
  "empty-tray": "empty-tray",
  "first-discovery": "first-discovery",
  "no-results": "no-results",
  welcome: "welcome",
} as const;

export type Icon3DName = keyof typeof ICONS;

/**
 * Renders one of the 3D marks. Decorative by default: these always sit beside
 * a real heading or label, so announcing them would just duplicate it. Pass an
 * `alt` only when the icon is the sole carrier of meaning.
 */
export function Icon3D({
  name,
  size = 48,
  alt,
  className,
}: {
  name: Icon3DName;
  size?: number;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static WebP
    <img
      src={`/brand/icons/${ICONS[name]}.webp`}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}
