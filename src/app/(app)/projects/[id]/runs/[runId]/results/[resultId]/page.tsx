import Link from "next/link";
import { notFound } from "next/navigation";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, Chip, CodeBlock, PageHeader, StatusBadge, cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { ClassificationPanel } from "@/components/classification-panel";
import { getResult } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { relativeTime, toUiStatus } from "@/lib/format";

/**
 * One recorded result.
 *
 * The previous version offered video replay, a network trace and a console log
 * beside an AI root-cause panel. None of that is captured - the runner records
 * a status, a duration, the failure message and a screenshot - so the page
 * shows those rather than four tabs of invented evidence. Reinstating the
 * others is a matter of persisting Playwright's trace, not of UI.
 */
export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string; resultId: string }>;
}) {
  const { id, runId, resultId } = await params;
  const userId = await currentUserId();

  const result = await getResult(userId, runId, resultId);
  if (!result) notFound();

  const passed = result.status === "pass";

  return (
    <PageBody>
      <PageHeader
        title={result.title}
        description={`${passed ? "Passed" : "Failed"} in ${result.durationMs ?? 0}ms · run ${runId.slice(0, 8)} · ${relativeTime(result.runStartedAt)}`}
        actions={
          <>
            <StatusBadge status={toUiStatus(result.status)} />
            <Link href={`/projects/${id}/runs/${runId}`}>
              <Button variant="ghost">Back to run</Button>
            </Link>
          </>
        }
      />

      {result.classification && (
        <div className="mb-4">
          <ClassificationPanel
            classification={result.classification}
            confidence={result.classificationConfidence}
            evidence={result.classificationEvidence}
          />
        </div>
      )}

      {result.errorMessage && (
        <Card title="Failure" padded={false}>
          <pre className="text-body-sm text-secondary max-h-72 overflow-auto p-4 font-mono whitespace-pre-wrap">
            {result.errorMessage}
          </pre>
        </Card>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={passed ? "Screenshot" : "Screenshot at failure"}>
          {result.screenshotUrl ? (
            <a href={result.screenshotUrl} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- served from a route, dimensions vary */}
              <img
                src={result.screenshotUrl}
                alt={`Screenshot for ${result.title}`}
                className={cn("border-muted w-full rounded-lg border", !passed && "border-error-stroke/50")}
              />
            </a>
          ) : (
            <p className="text-body-md text-tertiary">
              No screenshot was captured for this result.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Expected">
            <p className="text-body-md text-secondary">{result.expectedResult}</p>
          </Card>

          {result.steps.length > 0 && (
            <Card title="Steps" padded={false}>
              <ol className="flex flex-col gap-1.5 p-4">
                {result.steps.map((step, i) => (
                  <li key={i} className="text-body-md text-secondary flex gap-2">
                    <span className="text-quaternary tabular shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card title="Next">
            <div className="flex flex-col gap-2">
              <Link href={`/projects/${id}/tests/${result.testCaseId}`}>
                <Button className="w-full">Open the test</Button>
              </Link>
              {!passed && (
                <Link href={`/projects/${id}/healing`}>
                  <Button variant="ghost" className="w-full">
                    <AppIcon name="maintenance" size="sm" />
                    Try healing the selector
                  </Button>
                </Link>
              )}
            </div>
            <Chip className="mt-3">{result.status ?? "unknown"}</Chip>
          </Card>
        </div>
      </div>

      {result.playwrightCode && (
        <Card className="mt-5" title="Spec" padded={false}>
          <CodeBlock code={result.playwrightCode} language="ts" />
        </Card>
      )}
    </PageBody>
  );
}
