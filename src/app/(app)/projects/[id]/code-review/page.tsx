import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { listCodeReviews, resolveProject } from "@/db/queries";

import { CodeReviewView, type Review } from "./code-review-view";

export default async function CodeReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const rows = await listCodeReviews(userId, project.id);

  // "2m ago" is formatted here rather than in the client, so the server and
  // client markup agree and hydration does not warn.
  const reviews: Review[] = rows.map((r) => ({
    id: r.id,
    sha: r.sha,
    message: r.message,
    author: r.author,
    recommendation: (r.recommendation ?? "COMMENT") as Review["recommendation"],
    summary: r.summary,
    securityFlags: r.securityFlags ?? [],
    whenLabel: r.createdAt ? relativeTime(r.createdAt) : "",
    comments: r.comments.map((c) => ({
      id: c.id,
      file: c.file,
      line: c.line,
      severity: (c.severity ?? "low") as Review["comments"][number]["severity"],
      category: (c.category ?? "maintainability") as Review["comments"][number]["category"],
      title: c.title,
      body: c.body,
      suggestion: c.suggestion,
    })),
  }));

  return <CodeReviewView reviews={reviews} />;
}
