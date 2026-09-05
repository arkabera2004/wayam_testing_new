import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";

import { currentUserId } from "@/lib/auth";
import {
  discoverySummary,
  listHealingEvents,
  listRunsWithCounts,
  passRateTrend,
  projectStats,
  resolveProject,
} from "@/db/queries";
import { relativeTime, toUiStatus } from "@/lib/format";

import { PageBody } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  Chip,
  PassFailBar,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";


export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/projects/${id}`;

  const userId = await currentUserId();
  const dbProject = await resolveProject(userId, id);
  if (!dbProject) notFound();
  const [stats, recentRuns, discovery, healing, trend] = await Promise.all([
    projectStats(userId, dbProject.id),
    listRunsWithCounts(userId, dbProject.id, 5),
    discoverySummary(userId, dbProject.id),
    listHealingEvents(userId, dbProject.id),
    // The sparkline used to be a fixed demo curve, identical on every project.
    passRateTrend(userId, dbProject.id),
  ]);
  const latestRun = recentRuns[0] ?? null;

  return (
    <PageBody>
      <PageHeader
        title={dbProject.name}
        display
        description={dbProject.description ?? `Tracking ${dbProject.githubRepoUrl ?? "this project"} on ${dbProject.githubDefaultBranch ?? "main"}.`}
        actions={
          <>
            <Chip tone="neutral">
              <AppIcon name="globe" size="xs" aria-hidden="true" />
              {dbProject.githubDefaultBranch ?? "main"}
            </Chip>
            <Link href={latestRun ? `${base}/runs/${latestRun.id}` : `${base}/runs`}>
              <Button variant="primary" icon="arrowRight">
                View latest run
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tests" value={String(stats.tests)} delta="in the suite" />
        <StatCard label="Pass rate" value={`${stats.passRate}%`} delta={`${stats.runs} runs`} trend={trend} />
        {/* No coverage percentage is measured; pages crawled is what exists. */}
        <StatCard label="Pages crawled" value={String(discovery.stats.pages)} delta={`${discovery.stats.gated} auth-gated`} />
        <StatCard label="Locators healed" value={String(healing.stats.healedThisMonth)} delta="this month" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Recent runs"
          actions={
            <Link href={`${base}/runs`}>
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          }
          padded={false}
        >
          <Table>
            <thead>
              <tr>
                <Th>Run</Th>
                <Th>Trigger</Th>
                <Th>Result</Th>
                <Th className="text-right">Duration</Th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id} className="hover:bg-raised transition-colors duration-[170ms]">
                  <Td>
                    <Link href={`${base}/runs/${run.id}`} className="text-label-md text-primary tabular">
                      #{run.id.slice(0, 8)}
                    </Link>
                    <span className="text-body-sm text-quaternary ml-2">
                      {relativeTime(run.startedAt)}
                    </span>
                  </Td>
                  <Td>
                    <Chip>{run.triggeredBy ?? "unknown"}</Chip>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <StatusBadge status={toUiStatus(run.status)} />
                      <span className="w-24">
                        <PassFailBar passed={run.passed} failed={run.failed} flaky={run.skipped} />
                      </span>
                    </span>
                  </Td>
                  <Td className="tabular text-right">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Discovery">
            <dl className="flex flex-col gap-3">
              {[
                { label: "Pages found", value: discovery.stats.pages },
                { label: "Journeys mapped", value: discovery.stats.journeys },
                { label: "API endpoints", value: discovery.stats.apis },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between">
                  <dt className="text-body-md text-tertiary">{row.label}</dt>
                  <dd className="font-display text-display-xs text-primary tabular">{row.value}</dd>
                </div>
              ))}
            </dl>
            <Link href={`${base}/map`} className="mt-4 block">
              <Button className="w-full">Open application map</Button>
            </Link>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Icon3D name="time-saved" size={56} />
              <div>
                <p className="text-heading-sm text-primary">
                  {healing.stats.healedToday} locators healed today
                </p>
                <p className="text-body-md text-tertiary mt-1">
                  Roughly {healing.stats.hoursSaved} hours of maintenance saved this month.
                </p>
              </div>
            </div>
            <Link href={`${base}/healing`} className="mt-4 block">
              <Button className="w-full">Review healing events</Button>
            </Link>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
