

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, PageHeader, Table, Td, Th, cn } from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";
import { quarantined } from "@/lib/demo-data";

/** Tiny pass/fail variance strip: one bar per recent run. */
function VarianceChart({ variance }: { variance: number[] }) {
  return (
    <div className="flex h-5 items-end gap-0.5" aria-hidden="true">
      {variance.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-sm",
            v ? "bg-success-icon h-full" : "bg-error-icon h-1/3",
          )}
        />
      ))}
    </div>
  );
}

export default function QuarantinePage() {
  return (
    <PageBody>
      <PageHeader
        title="Quarantine"
        description="Unstable tests are isolated automatically so they cannot block a release."
      />

      <div className="border-warning-stroke/40 bg-warning-surface flex items-start gap-3 rounded-xl border p-4">
        <Icon3D name="quarantine" size={56} />
        <p className="text-body-md text-secondary">
          Tests with unstable pass/fail patterns are auto-quarantined. They keep running and
          reporting, but they never fail the quality gate until you un-quarantine them.
        </p>
      </div>

      <Card padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Test</Th>
              <Th className="text-right">Flakiness</Th>
              <Th>Recent runs</Th>
              <Th>Pattern</Th>
              <Th>Flagged</Th>
              <Th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {quarantined.map((q) => (
              <tr key={q.test} className="hover:bg-raised transition-colors duration-[170ms]">
                <Td className="text-primary">{q.test}</Td>
                <Td className="text-right">
                  <span className="text-label-md text-warning tabular">{q.score}</span>
                  <span className="text-caption text-quaternary">/100</span>
                </Td>
                <Td>
                  <VarianceChart variance={q.variance} />
                </Td>
                <Td>{q.pattern}</Td>
                <Td className="text-quaternary whitespace-nowrap">{q.flagged}</Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm">Investigate</Button>
                    <Button size="sm" variant="ghost">
                      Un-quarantine
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </PageBody>
  );
}
