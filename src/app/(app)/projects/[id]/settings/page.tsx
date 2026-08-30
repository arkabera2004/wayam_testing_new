"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  Chip,
  PageHeader,
  ProgressBar,
  Table,
  Td,
  Th,
  cn,
} from "@/components/ui";
import { invoices, project, workspace } from "@/lib/demo-data";

const TABS = ["General", "Environments", "Test generation", "Notifications", "Billing"] as const;

function Field({
  id,
  label,
  defaultValue,
  type = "text",
}: {
  id: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md text-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        defaultValue={defaultValue}
        className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-3 focus-visible:outline-none"
      />
    </div>
  );
}

export default function ProjectSettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("General");
  const usagePct = Math.round((workspace.minutesUsed / workspace.minutesTotal) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <PageHeader title="Project settings" />
      </div>

      <div className="border-muted mt-4 flex gap-1 overflow-x-auto border-b px-5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "true" : undefined}
            className={cn(
              "text-label-md -mb-px border-b-2 px-3 py-2.5 whitespace-nowrap transition-colors duration-[170ms]",
              tab === t
                ? "border-action-primary text-primary"
                : "text-tertiary hover:text-secondary border-transparent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageBody>
          {tab === "General" && (
            <>
              <Card title="Project">
                <div className="flex flex-col gap-4">
                  <Field id="p-name" label="Project name" defaultValue={project.name} />
                  <Field id="p-url" label="Target URL" defaultValue={project.url} />
                  <Field id="p-repo" label="Repository" defaultValue={project.repo} />
                  <Field id="p-branch" label="Default branch" defaultValue={project.branch} />
                  <div>
                    <Button variant="primary">Save changes</Button>
                  </div>
                </div>
              </Card>

              <Card title="Danger zone">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-heading-sm text-primary">Delete this project</p>
                    <p className="text-body-md text-tertiary mt-1">
                      Removes all tests, runs and healing history. This cannot be undone.
                    </p>
                  </div>
                  <Button variant="danger" icon={Trash2}>
                    Delete project
                  </Button>
                </div>
              </Card>
            </>
          )}

          {tab === "Environments" && (
            <Card title="Environments" padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Base URL</Th>
                    <Th>Credentials</Th>
                    <Th className="w-32" />
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "production", url: "https://shopstack.demo" },
                    { name: "staging", url: "https://staging.shopstack.demo" },
                  ].map((env) => (
                    <tr key={env.name}>
                      <Td>
                        <Chip tone={env.name === "production" ? "solid" : "neutral"}>
                          {env.name}
                        </Chip>
                      </Td>
                      <Td className="text-primary">{env.url}</Td>
                      <Td className="text-quaternary">demo@shopstack.demo / ••••••••</Td>
                      <Td>
                        <Button size="sm">Re-record</Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {tab === "Test generation" && (
            <Card title="Generation preferences">
              <div className="flex flex-col gap-5">
                <div className="flex max-w-md flex-col gap-1.5">
                  <label htmlFor="model" className="text-label-md text-secondary">
                    Model tier
                  </label>
                  <select
                    id="model"
                    defaultValue="Balanced"
                    className="border-muted bg-raised text-body-md text-primary h-9 rounded-lg border px-2.5 focus-visible:outline-none"
                  >
                    <option>Fast</option>
                    <option>Balanced</option>
                    <option>Thorough</option>
                  </select>
                  <p className="text-body-sm text-quaternary">
                    Thorough explores more edge cases and costs more test-minutes.
                  </p>
                </div>

                <Field id="max-scenarios" label="Max scenarios per plan" defaultValue="50" type="number" />

                <div className="flex max-w-md flex-col gap-1.5">
                  <span className="text-label-md text-secondary">Excluded paths</span>
                  <div className="border-muted bg-raised flex flex-wrap gap-1.5 rounded-lg border p-2">
                    <Chip>/admin/*</Chip>
                    <Chip>/api/internal/*</Chip>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {tab === "Notifications" && (
            <Card title="Notification preferences" padded={false}>
              <Table>
                <thead>
                  <tr>
                    <Th>Event</Th>
                    <Th className="text-center">Email</Th>
                    <Th className="text-center">Slack</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { event: "Test failure", email: true, slack: true },
                    { event: "Locator healed", email: false, slack: true },
                    { event: "Test quarantined", email: false, slack: true },
                    { event: "Quality gate blocked a merge", email: true, slack: true },
                  ].map((row) => (
                    <tr key={row.event}>
                      <Td className="text-primary">{row.event}</Td>
                      <Td className="text-center">
                        <input
                          type="checkbox"
                          defaultChecked={row.email}
                          aria-label={`Email for ${row.event}`}
                          className="accent-primary"
                        />
                      </Td>
                      <Td className="text-center">
                        <input
                          type="checkbox"
                          defaultChecked={row.slack}
                          aria-label={`Slack for ${row.event}`}
                          className="accent-primary"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {tab === "Billing" && (
            <>
              <Card title="Current plan">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-display-sm text-primary">{workspace.plan}</p>
                    <p className="text-body-md text-tertiary mt-1">
                      Usage-based. Unlimited seats.
                    </p>
                  </div>
                  <Button variant="primary">Upgrade</Button>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-label-md text-secondary">Test minutes</span>
                    <span className="text-label-sm text-tertiary tabular">
                      {workspace.minutesUsed.toLocaleString()} /{" "}
                      {workspace.minutesTotal.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={usagePct} className="mt-2" />
                </div>
              </Card>

              <Card title="Invoices" padded={false}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Invoice</Th>
                      <Th>Date</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <Td className="text-primary tabular">{inv.id}</Td>
                        <Td>{inv.date}</Td>
                        <Td className="tabular text-right">{inv.amount}</Td>
                        <Td>
                          <Chip tone="success">{inv.status}</Chip>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}
