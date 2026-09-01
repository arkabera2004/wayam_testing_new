import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";

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
import {
  coverageTrend,
  discoveryStats,
  healingStats,
  passRateTrend,
  project,
  runs,
} from "@/lib/demo-data";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/projects/${id}`;

  return (
    <PageBody>
      <PageHeader
        title={project.name}
        display
        description={`Testing ${project.url} on branch ${project.branch}.`}
        actions={
          <>
            <Chip tone="neutral">
              <Globe size={12} aria-hidden="true" />
              {project.environment}
            </Chip>
            <Link href={`${base}/runs/137`}>
              <Button variant="primary" icon={ArrowRight}>
                View latest run
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tests" value={String(project.tests)} delta="+6" deltaTone="success" />
        <StatCard label="Pass rate (30d)" value={`${project.passRate}%`} delta="+1.2" deltaTone="success" trend={passRateTrend} />
        <StatCard label="Coverage" value={`${project.coverage}%`} delta="+4" deltaTone="success" trend={coverageTrend} />
        <StatCard label="Locators healed" value={String(healingStats.healedThisMonth)} delta="this month" />
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
              {runs.slice(0, 5).map((run) => (
                <tr key={run.id} className="hover:bg-raised transition-colors duration-[170ms]">
                  <Td>
                    <Link href={`${base}/runs/${run.id}`} className="text-label-md text-primary tabular">
                      #{run.id}
                    </Link>
                    <span className="text-body-sm text-quaternary ml-2">{run.started}</span>
                  </Td>
                  <Td>
                    <Chip>{run.trigger}</Chip>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <StatusBadge status={run.status} />
                      <span className="w-24">
                        <PassFailBar passed={run.passed} failed={run.failed} flaky={run.flaky} />
                      </span>
                    </span>
                  </Td>
                  <Td className="tabular text-right">{run.duration}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Discovery">
            <dl className="flex flex-col gap-3">
              {[
                { label: "Pages found", value: discoveryStats.pages },
                { label: "Journeys mapped", value: discoveryStats.journeys },
                { label: "API endpoints", value: discoveryStats.apis },
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
                  {healingStats.healedToday} locators healed today
                </p>
                <p className="text-body-md text-tertiary mt-1">
                  Roughly {healingStats.hoursSaved} hours of maintenance saved this month.
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
