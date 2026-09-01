"use client";

import { useState } from "react";

import { PageBody } from "@/components/layout/app-shell";
import {
  Avatar,
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
import { ActionButton } from "@/components/ui/action-button";
import { apiKeys, invoices, users, workspace } from "@/lib/demo-data";

const TABS = ["Profile", "Team", "API keys", "Billing"] as const;

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

export default function WorkspaceSettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const usagePct = Math.round((workspace.minutesUsed / workspace.minutesTotal) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <PageHeader title="Workspace settings" description={workspace.name} />
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
          {tab === "Profile" && (
            <Card title="Your profile">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Avatar initials={users[0].initials} size={40} />
                  <ActionButton size="sm" title="Avatar upload unavailable" body="Image uploads need storage, which this build does not have.">Change avatar</ActionButton>
                </div>
                <Field id="name" label="Full name" defaultValue={users[0].name} />
                <Field id="email" label="Email" defaultValue="aarav@acme.inc" type="email" />
                <Field id="password" label="New password" type="password" />
                <div>
                  <ActionButton variant="primary" tone="success" title="Profile saved">Save profile</ActionButton>
                </div>
              </div>
            </Card>
          )}

          {tab === "Team" && (
            <Card
              title="Members"
              subtitle="Seats are unlimited on every plan"
              actions={
                <ActionButton icon="add" size="sm" title="Invite sent" body="They will get an email to join Acme Inc.">
                  Invite
                </ActionButton>
              }
              padded={false}
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Member</Th>
                    <Th>Role</Th>
                    <Th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <Avatar initials={u.initials} />
                          <span className="text-label-md text-primary">{u.name}</span>
                        </span>
                      </Td>
                      <Td>
                        <select
                          defaultValue={u.role}
                          aria-label={`Role for ${u.name}`}
                          className="border-muted bg-raised text-label-md text-secondary h-8 rounded-lg border px-2.5 focus-visible:outline-none"
                        >
                          <option>Admin</option>
                          <option>Editor</option>
                          <option>Viewer</option>
                        </select>
                      </Td>
                      <Td>
                        <ActionButton size="sm" variant="ghost" tone="warning" title="Member removed" body="They lose access to every project in this workspace.">
                          Remove
                        </ActionButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {tab === "API keys" && (
            <Card
              title="API keys"
              subtitle="Used by CI and the Parikshan CLI"
              actions={
                <ActionButton icon="add" size="sm" tone="success" title="API key created" body="Copy it now — it is not shown again.">
                  Create key
                </ActionButton>
              }
              padded={false}
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Key</Th>
                    <Th>Created</Th>
                    <Th>Last used</Th>
                    <Th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.name}>
                      <Td className="text-primary">{k.name}</Td>
                      <Td className="text-quaternary">{k.key}</Td>
                      <Td>{k.created}</Td>
                      <Td>{k.lastUsed}</Td>
                      <Td>
                        <ActionButton size="sm" variant="ghost" icon="delete" tone="warning" aria-label={`Revoke ${k.name}`} title="Key revoked" body="Any CI job using it will start failing.">
                          Revoke
                        </ActionButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {tab === "Billing" && (
            <>
              <Card title="Plan and usage">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-display-sm text-primary">{workspace.plan}</p>
                    <Chip className="mt-2">Usage-based, unlimited seats</Chip>
                  </div>
                  <ActionButton variant="primary" title="Billing portal unavailable" body="Plan management needs a billing provider.">Manage plan</ActionButton>
                </div>
                <div className="mt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-label-md text-secondary">Test minutes this cycle</span>
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
