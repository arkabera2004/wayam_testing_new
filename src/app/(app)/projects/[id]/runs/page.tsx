import Link from "next/link";
import { Play } from "lucide-react";

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
import { runs } from "@/lib/demo-data";

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageBody>
      <PageHeader
        title="Runs"
        description="Every execution of the suite, triggered by pull requests, schedules or on demand."
        actions={
          <Link href={`/projects/${id}/runs/137`}>
            <Button variant="primary" icon={Play}>
              Run suite
            </Button>
          </Link>
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
                    <span className="text-label-md text-primary tabular">#{run.id}</span>
                    <span className="text-caption text-quaternary block">{run.started}</span>
                  </Link>
                </Td>
                <Td>
                  <Chip>{run.trigger}</Chip>
                </Td>
                <Td className="whitespace-nowrap">{run.branch}</Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={run.status} />
                    <div className="w-28">
                      <PassFailBar passed={run.passed} failed={run.failed} flaky={run.flaky} />
                      <span className="text-caption text-quaternary tabular mt-1 block">
                        {run.passed} passed · {run.failed} failed · {run.flaky} flaky
                      </span>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="text-caption text-quaternary">Ch · FF · WK</span>
                </Td>
                <Td className="tabular text-right">{run.duration}</Td>
                <Td>
                  <Avatar initials={run.initiator} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </PageBody>
  );
}
