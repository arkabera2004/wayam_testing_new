"use client";

import { useState } from "react";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import type { ReviewCategory, ReviewRecommendation, ReviewSeverity } from "@/lib/demo-data";

export type ReviewComment = {
  id: string;
  file: string;
  line: number | null;
  severity: ReviewSeverity;
  category: ReviewCategory;
  title: string;
  body: string | null;
  suggestion: string | null;
};

export type Review = {
  id: string;
  sha: string;
  message: string;
  author: string | null;
  recommendation: ReviewRecommendation;
  summary: string | null;
  securityFlags: string[];
  whenLabel: string;
  comments: ReviewComment[];
};
import type { IconName } from "@/lib/icons";

/**
 * Ported from AIDLC-Azure's Code Reviewer. The severity ladder, the four
 * recommendation verdicts, the six finding categories and the separate
 * security-flag list are carried over as-is. Reviews are read from Postgres;
 * they are produced by seeding or by an upstream analysis writing rows, not by
 * a live model call from this page.
 */
const SEVERITY: Record<ReviewSeverity, { label: string; text: string; surface: string; icon: IconName }> = {
  critical: { label: "Critical", text: "text-error", surface: "bg-error-surface", icon: "warning" },
  high: { label: "High", text: "text-warning", surface: "bg-warning-surface", icon: "warning" },
  medium: { label: "Medium", text: "text-info", surface: "bg-info-surface", icon: "info" },
  low: { label: "Low", text: "text-tertiary", surface: "bg-raised", icon: "info" },
};

const RECOMMENDATION: Record<
  ReviewRecommendation,
  { label: string; description: string; text: string; surface: string; icon: IconName }
> = {
  APPROVE: {
    label: "Approved",
    description: "No blocking issues. Ready to merge.",
    text: "text-success",
    surface: "bg-success-surface",
    icon: "check",
  },
  REQUEST_CHANGES: {
    label: "Changes requested",
    description: "Issues found that must be resolved before merging.",
    text: "text-error",
    surface: "bg-error-surface",
    icon: "close",
  },
  COMMENT: {
    label: "Commented",
    description: "Suggestions provided — not blocking, but worth reading.",
    text: "text-warning",
    surface: "bg-warning-surface",
    icon: "info",
  },
  CONDITIONAL: {
    label: "Conditional",
    description: "Can merge once the listed conditions are addressed.",
    text: "text-warning",
    surface: "bg-warning-surface",
    icon: "warning",
  },
};

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  security: "security",
  bug: "bug",
  performance: "performance",
  style: "style",
  "test-coverage": "test coverage",
  maintainability: "maintainability",
};

const SEVERITY_ORDER: ReviewSeverity[] = ["critical", "high", "medium", "low"];

export function CodeReviewView({ reviews }: { reviews: Review[] }) {
  const [openSha, setOpenSha] = useState<string>(reviews[0]?.sha ?? "");
  const [category, setCategory] = useState<ReviewCategory | "all">("all");

  return (
    <PageBody>
      <PageHeader
        title="Code Reviewer"
        description="Every commit read for security, correctness and coverage before it reaches the suite."
        actions={
          <ActionButton icon="refresh" title="Re-running review" body="Parikshan is re-reading the latest commits.">
            Re-run review
          </ActionButton>
        }
      />

      {reviews.length === 0 && (
        <Card title="No reviews yet">
          <p className="text-body-md text-tertiary">
            Nothing has been reviewed for this project. Reviews appear here once a commit has been
            analysed.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {reviews.map((review) => {
          const rec = RECOMMENDATION[review.recommendation];
          const open = openSha === review.sha;
          const counts = SEVERITY_ORDER.map((s) => ({
            s,
            n: review.comments.filter((c) => c.severity === s).length,
          })).filter((x) => x.n > 0);
          const visible =
            category === "all" ? review.comments : review.comments.filter((c) => c.category === category);

          return (
            <Card key={review.sha} padded={false}>
              {/* ---- Commit header ---- */}
              <button
                type="button"
                onClick={() => setOpenSha(open ? "" : review.sha)}
                aria-expanded={open}
                className="hover:bg-raised flex w-full items-start gap-3 p-4 text-left transition-colors duration-[170ms]"
              >
                <AppIcon
                  name={open ? "chevronDown" : "chevronRight"}
                  size="sm"
                  className="icon-quaternary mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-label-sm text-tertiary font-mono">{review.sha}</span>
                    <span className="text-heading-sm text-primary">{review.message}</span>
                  </div>
                  <p className="text-caption text-quaternary mt-1">
                    {review.author} · {review.whenLabel}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {counts.map(({ s, n }) => (
                    <span key={s} className={cn("text-label-sm tabular rounded-full px-2 py-0.5", SEVERITY[s].surface, SEVERITY[s].text)}>
                      {n} {SEVERITY[s].label.toLowerCase()}
                    </span>
                  ))}
                  <span className={cn("text-label-sm inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5", rec.surface, rec.text)}>
                    <AppIcon name={rec.icon} size="xs" />
                    {rec.label}
                  </span>
                </div>
              </button>

              {open && (
                <div className="border-muted border-t">
                  <div className="p-4">
                    <p className="text-body-md text-secondary">{review.summary}</p>
                    <p className="text-caption text-quaternary mt-1">{rec.description}</p>
                  </div>

                  {/* ---- Security flags ---- */}
                  {review.securityFlags.length > 0 && (
                    <div className="border-error-stroke/30 bg-error-surface mx-4 mb-4 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <AppIcon name="warning" size="sm" className="text-error" />
                        <span className="text-label-sm text-error">
                          Security flags ({review.securityFlags.length})
                        </span>
                      </div>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {review.securityFlags.map((f) => (
                          <li key={f} className="text-body-sm text-secondary">
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ---- Category filter ---- */}
                  <div className="border-muted flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
                    <AppIcon name="filter" size="xs" className="icon-quaternary" />
                    <button type="button" onClick={() => setCategory("all")}>
                      <Chip tone={category === "all" ? "solid" : "neutral"}>all {review.comments.length}</Chip>
                    </button>
                    {(Object.keys(CATEGORY_LABEL) as ReviewCategory[]).map((c) => {
                      const n = review.comments.filter((x) => x.category === c).length;
                      if (!n) return null;
                      return (
                        <button key={c} type="button" onClick={() => setCategory(category === c ? "all" : c)}>
                          <Chip tone={category === c ? "solid" : "neutral"}>
                            {CATEGORY_LABEL[c]} {n}
                          </Chip>
                        </button>
                      );
                    })}
                  </div>

                  {/* ---- Findings ---- */}
                  <ul className="divide-muted flex flex-col divide-y">
                    {visible.map((c) => {
                      const sev = SEVERITY[c.severity];
                      return (
                        <li key={c.id} className="hover:bg-raised px-4 py-3.5 transition-colors duration-[170ms]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-label-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5", sev.surface, sev.text)}>
                              <AppIcon name={sev.icon} size="xs" />
                              {sev.label}
                            </span>
                            <Chip>{CATEGORY_LABEL[c.category]}</Chip>
                            <span className="text-caption text-quaternary font-mono">
                              {c.file}:{c.line}
                            </span>
                          </div>
                          <p className="text-label-md text-primary mt-2">{c.title}</p>
                          <p className="text-body-md text-secondary mt-1">{c.body}</p>
                          {c.suggestion && (
                            <p className="text-body-sm text-tertiary bg-raised mt-2 rounded-lg px-3 py-2">
                              <span className="text-success">Suggested fix — </span>
                              {c.suggestion}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </PageBody>
  );
}
