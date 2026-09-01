"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Github, Globe, MoreHorizontal, Play, Plus, Settings } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Th,
  EmptyState,
} from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { passRateTrend } from "@/lib/demo-data";
import type { ProjectSummary, WorkspaceStats } from "@/db/queries";
import { relativeTime, toUiStatus } from "@/lib/format";

export function ProjectsTable({
  projects,
  stats,
}: {
  projects: ProjectSummary[];
  stats: WorkspaceStats;
}) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <PageBody>
      <PageHeader
        title="Projects"
        description="Every application Parikshan is testing for Acme Inc."
        actions={
          <Link href="/projects/new">
            <Button variant="primary" icon={Plus}>
              New project
            </Button>
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={Plus}
          art={<Icon3D name="first-discovery" size={96} />}
          title="No projects yet"
          description="Point Parikshan at a URL or a repository and it will explore the app, propose a test plan, and keep the suite green."
          action={
            <Link href="/projects/new">
              <Button variant="primary" icon={Plus}>
                Create your first project
              </Button>
            </Link>
          }
        />
      ) : (
      <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total projects" value={String(stats.projects)} />
        <StatCard label="Tests" value={String(stats.tests)} delta="across all projects" />
        <StatCard
          label="Pass rate"
          value={stats.passRate === null ? "No runs yet" : `${stats.passRate}%`}
          delta={stats.runs ? `${stats.runs} runs` : undefined}
          deltaTone={stats.passRate !== null && stats.passRate >= 95 ? "success" : undefined}
          trend={passRateTrend}
        />
        <StatCard
          label="Test time"
          value={stats.testMs ? `${(stats.testMs / 1000).toFixed(1)}s` : "—"}
          delta="summed spec time"
        />
      </div>

      <Card title="All projects" padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Source</Th>
              <Th className="text-right">Tests</Th>
              <Th>Last run</Th>
              <Th>Coverage</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-raised transition-colors duration-[170ms]">
                <Td>
                  <Link href={`/projects/${p.slug}`} className="flex items-center gap-2.5">
                    <span className="bg-raised-2 text-label-sm text-secondary grid h-6 w-6 shrink-0 place-items-center rounded">
                      {p.name.charAt(0)}
                    </span>
                    <span className="text-label-md text-primary">{p.name}</span>
                  </Link>
                </Td>
                <Td>
                  <span className="text-body-sm text-tertiary flex items-center gap-1.5">
                    {p.githubRepoUrl ? (
                      <Github size={13} className="shrink-0" aria-hidden="true" />
                    ) : (
                      <Globe size={13} className="shrink-0" aria-hidden="true" />
                    )}
                    {p.githubRepoUrl?.replace("https://github.com/", "") ?? p.description ?? "—"}
                  </span>
                </Td>
                <Td className="tabular text-right">{p.tests}</Td>
                <Td>
                  {p.lastRunStatus ? (
                    <span className="flex items-center gap-2">
                      <StatusBadge status={toUiStatus(p.lastRunStatus)} />
                      <span className="text-body-sm text-quaternary">{p.lastRunAt ? relativeTime(p.lastRunAt) : "time unknown"}</span>
                    </span>
                  ) : (
                    <span className="text-body-sm text-quaternary">No runs yet</span>
                  )}
                </Td>
                <Td>
                  {p.coverage === null ? (
                    <span className="text-body-sm text-quaternary">Not measured</span>
                  ) : (
                    <span className="flex w-32 items-center gap-2">
                      <ProgressBar value={p.coverage} className="flex-1" />
                      <span className="text-body-sm text-tertiary tabular shrink-0">{p.coverage}%</span>
                    </span>
                  )}
                </Td>
                <Td>
                  <Menu
                    label={`Actions for ${p.name}`}
                    trigger={<MoreHorizontal size={15} aria-hidden="true" />}
                    items={[
                      {
                        label: "Run suite",
                        icon: Play,
                        onSelect: () => {
                          toast({ tone: "info", title: `${p.name} suite queued` });
                          router.push(`/projects/${p.slug}/runs`);
                        },
                      },
                      {
                        label: "Settings",
                        icon: Settings,
                        onSelect: () => router.push(`/projects/${p.slug}/settings`),
                      },
                      {
                        label: "Archive",
                        icon: Archive,
                        danger: true,
                        onSelect: () => toast({ tone: "warning", title: `${p.name} archived` }),
                      },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      </>
      )}
    </PageBody>
  );
}
