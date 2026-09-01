import Link from "next/link";
import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth";
import { listRunsWithCounts, resolveProject } from "@/db/queries";
import { relativeTime, toUiStatus } from "@/lib/format";
import { RunSuiteButton } from "@/components/run-suite-button";

import { PageBody } from "@/components/layout/app-shell";
import {
  Avatar,
  Button,
  Card,
  Chip,
  PageHeader,
  PassFailBar,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  const project = await resolveProject(userId, id);
  if (!project) notFound();
  const runs = await listRunsWithCounts(userId, project.id);

  return (
    <PageBody>
      <PageHeader
        title="Runs"
        description="Every execution of the suite, triggered by pull requests, schedules or on demand."
        actions={
          <RunSuiteButton projectSlug={id} />
        }
      />

      <Card padded={false}>
        <div className="border-muted flex flex-wrap items-center gap-2 border-b px-4 py-3">
          {["All branches", "All triggers", "All statuses", "Last 30 days"].map((f) => (
            <select
              key={f}
              aria-label={f}
              className="border-muted bg-raised text-label-md text-secondary h-8 rounded-lg border px-2.5 focus-visible:outline-none"
            >
              <option>{f}</option>
            </select>
          ))}
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Run</Th>
              <Th>Trigger</Th>
              <Th>Branch</Th>
              <Th>Result</Th>
              <Th>Browsers</Th>
              <Th className="text-right">Duration</Th>
              <Th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-raised transition-colors duration-[170ms]">
                <Td>
                  <Link href={`/projects/${id}/runs/${run.id}`} className="block">
                    <span className="text-label-md text-primary tabular">
                      #{run.id.slice(0, 8)}
                    </span>
                    <span className="text-caption text-quaternary block">
                      {relativeTime(run.startedAt)}
                    </span>
                  </Link>
                </Td>
                <Td>
                  <Chip>{run.triggeredBy ?? "unknown"}</Chip>
                </Td>
                <Td className="whitespace-nowrap">{project.githubDefaultBranch ?? "—"}</Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={toUiStatus(run.status)} />
                    <div className="w-28">
                      <PassFailBar passed={run.passed} failed={run.failed} flaky={run.skipped} />
                      <span className="text-caption text-quaternary tabular mt-1 block">
                        {run.passed} passed · {run.failed} failed · {run.skipped} skipped
                      </span>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="text-caption text-quaternary">Ch · FF · WK</span>
                </Td>
                <Td className="tabular text-right">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}</Td>
                <Td>
                  <Avatar initials={(run.triggeredBy ?? "?").slice(0, 2).toUpperCase()} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </PageBody>
  );
}
