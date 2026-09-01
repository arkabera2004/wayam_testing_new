import Link from "next/link";
import { notFound } from "next/navigation";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatCard, StatusBadge, cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { getRunWithResults } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { relativeTime, toUiStatus } from "@/lib/format";

/**
 * A recorded run: what was executed, what each case did, and the screenshot
 * captured at the end of it.
 *
 * This replaced an animated grid over demo data that lit up on a timer
 * regardless of what actually ran.
 */
export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const userId = await currentUserId();

  const data = await getRunWithResults(userId, runId);
  if (!data) notFound();

  const { run, results } = data;
  const passed = results.filter((r) => r.result.status === "pass").length;
  const failed = results.filter((r) => r.result.status === "fail" || r.result.status === "error").length;
  const durationMs =
    run.finishedAt && run.startedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

  // Failures first — the reason anyone opens this page.
  const ordered = [...results].sort((a, b) =>
    a.result.status === "pass" ? (b.result.status === "pass" ? 0 : 1) : -1,
  );

  return (
    <PageBody>
      <PageHeader
        title={`Run ${run.id.slice(0, 8)}`}
        description={`Triggered ${run.triggeredBy ?? "manually"} · started ${relativeTime(run.startedAt)}`}
        actions={<StatusBadge status={toUiStatus(run.status)} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tests" value={String(results.length)} />
        <StatCard label="Passed" value={String(passed)} deltaTone="success" />
        <StatCard label="Failed" value={String(failed)} deltaTone={failed ? "error" : undefined} />
        <StatCard
          label="Duration"
          value={durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
        />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {ordered.map(({ result, testCase }) => {
          const ok = result.status === "pass";
          return (
            <Card key={result.id} padded={false}>
              <div className="border-muted flex flex-wrap items-center gap-3 border-b px-4 py-3">
                <StatusBadge status={toUiStatus(result.status)} />
                <Link
                  href={`/projects/${id}/tests/${testCase.id}`}
                  className="text-label-md text-primary min-w-0 flex-1 truncate hover:underline"
                >
                  {testCase.title}
                </Link>
                <span className="text-caption text-quaternary tabular shrink-0">
                  {result.durationMs ?? 0}ms
                </span>
              </div>

              <div className="flex flex-col gap-3 p-4">
                {result.errorMessage && (
                  <pre className="text-body-sm text-secondary bg-raised max-h-48 overflow-auto rounded-lg p-3 font-mono whitespace-pre-wrap">
                    {result.errorMessage}
                  </pre>
                )}

                {result.screenshotUrl ? (
                  <figure className="min-w-0">
                    <figcaption className="text-label-sm text-tertiary mb-2 flex items-center gap-1.5">
                      <AppIcon name="fullscreen" size="xs" className="icon-quaternary" />
                      {ok ? "Baseline captured on pass" : "Screenshot at failure"}
                    </figcaption>
                    <a href={result.screenshotUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served from a route, dimensions vary */}
                      <img
                        src={result.screenshotUrl}
                        alt={`Screenshot for ${testCase.title}`}
                        className={cn(
                          "border-muted w-full max-w-2xl rounded-lg border",
                          !ok && "border-error-stroke/50",
                        )}
                      />
                    </a>
                  </figure>
                ) : (
                  <p className="text-body-sm text-quaternary">No screenshot recorded.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {results.length === 0 && (
        <Card className="mt-5">
          <p className="text-body-md text-tertiary">This run recorded no results.</p>
          <Chip className="mt-2">status: {run.status ?? "unknown"}</Chip>
        </Card>
      )}
    </PageBody>
  );
}
