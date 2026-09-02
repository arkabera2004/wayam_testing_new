"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/toast";

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
export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdLabel: string;
  lastUsedLabel: string;
  revoked: boolean;
};

export type Member = { id: string; name: string; initials: string; role: string };

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

export function WorkspaceSettingsView({
  workspaceName,
  members,
  initialKeys,
  testMinutes,
  runCount,
}: {
  workspaceName: string;
  members: Member[];
  initialKeys: ApiKeyRow[];
  testMinutes: number;
  runCount: number;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [busy, setBusy] = useState(false);
  // Shown once, immediately after minting. Only the hash is stored, so there
  // is no way to show it again later.
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  async function createKey() {
    if (!newKeyName.trim()) {
      toast({ tone: "error", title: "Name required", body: "Give the key a name you will recognise." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Could not create key", body: data.error });
        return;
      }
      setFreshSecret(data.secret);
      setKeys((prev) => [
        { id: data.id, name: data.name, prefix: data.secret.slice(0, 12), createdLabel: "just now", lastUsedLabel: "never", revoked: false },
        ...prev,
      ]);
      setNewKeyName("");
      toast({ tone: "success", title: "Key created", body: "Copy it now - it is not shown again." });
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string, name: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ tone: "error", title: "Could not revoke", body: "The key was not changed." });
        return;
      }
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
      toast({ tone: "info", title: `${name} revoked`, body: "Any job using it will start failing." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <PageHeader title="Workspace settings" description={workspaceName} />
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
                  <Avatar initials={members[0]?.initials ?? "?"} size={40} />
                  <ActionButton size="sm" title="Avatar upload unavailable" body="Image uploads need storage, which this build does not have.">Change avatar</ActionButton>
                </div>
                <Field id="name" label="Full name" defaultValue={members[0]?.name ?? ""} />
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
                  {members.map((u) => (
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
                <span className="flex items-center gap-2">
                  <input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name, e.g. CI"
                    aria-label="New API key name"
                    className="border-muted bg-raised text-body-md text-primary h-8 w-44 rounded-lg border px-2.5 focus-visible:outline-none"
                  />
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => void createKey()}>
                    Create key
                  </Button>
                </span>
              }
              padded={false}
            >
              {freshSecret && (
                <div className="border-muted bg-raised m-4 rounded-lg border p-3">
                  <p className="text-label-md text-primary">Copy this now - it is not shown again.</p>
                  <code className="text-body-sm text-secondary mt-1.5 block break-all">{freshSecret}</code>
                </div>
              )}
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
                  {keys.length === 0 && (
                    <tr>
                      <td className="text-body-md text-tertiary px-4 py-3" colSpan={5}>
                        No keys yet.
                      </td>
                    </tr>
                  )}
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <Td className="text-primary">{k.name}</Td>
                      <Td className="text-quaternary">{k.prefix}…</Td>
                      <Td>{k.createdLabel}</Td>
                      <Td>{k.lastUsedLabel}</Td>
                      <Td>
                        {k.revoked ? (
                          <Chip>Revoked</Chip>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Revoke ${k.name}`}
                            onClick={() => void revokeKey(k.id, k.name)}
                          >
                            Revoke
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {tab === "Billing" && (
            <Card title="Usage">
              <p className="text-body-md text-tertiary">
                There is no billing provider connected, so there is no plan, quota or invoice to
                show. What is measured is the time actually spent executing tests.
              </p>
              <div className="mt-5 flex flex-wrap gap-8">
                <div>
                  <p className="font-display text-display-sm text-primary tabular">
                    {testMinutes.toLocaleString()}
                  </p>
                  <p className="text-label-md text-secondary mt-1">Test minutes executed</p>
                </div>
                <div>
                  <p className="font-display text-display-sm text-primary tabular">
                    {runCount.toLocaleString()}
                  </p>
                  <p className="text-label-md text-secondary mt-1">Runs recorded</p>
                </div>
              </div>
            </Card>
          )}

        </PageBody>
      </div>
    </div>
  );
}
