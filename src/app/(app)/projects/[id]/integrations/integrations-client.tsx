"use client";

import { useState } from "react";
import { Check, Copy, GitPullRequest } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import {
  BrowserFrame,
  Button,
  Card,
  Chip,
  CodeBlock,
  PageHeader,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { workflowYaml } from "@/lib/demo-data";
import { GithubPanel } from "./github-panel";
import { copyText } from "@/lib/copy";

export function IntegrationsClient({
  github,
}: {
  github: { connected: boolean; username: string | null; connectedAtLabel: string | null; linkedRepo: string | null };
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    if (await copyText(workflowYaml)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      return;
    }
    toast({
      tone: "error",
      title: "Could not copy",
      body: "Your browser blocked clipboard access - select the text and copy manually.",
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Integrations"
        description="Parikshan reports into the tools your team already uses."
      />

      <GithubPanel
        connected={github.connected}
        username={github.username}
        connectedAtLabel={github.connectedAtLabel}
        linkedRepo={github.linkedRepo}
      />

      {/* GitHub Actions detail */}
      <Card
        title="GitHub Actions"
        subtitle="Generated workflow, committed to .github/workflows/e2e.yml"
        actions={
          <>
            <Chip>Template</Chip>
            <Button size="sm" icon={copied ? Check : Copy} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </>
        }
      >
        <CodeBlock code={workflowYaml} language="yaml" />
      </Card>

      {/* Slack detail */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Slack" subtitle="Not implemented - these controls are inert" actions={<Chip>Coming soon</Chip>}>
          <div className="flex flex-col gap-3">
            {[
              { label: "Test failures", on: true },
              { label: "Healed locators", on: true },
              { label: "Daily summary", on: false },
              { label: "Quarantine changes", on: true },
            ].map((row) => (
              <label key={row.label} className="flex items-center justify-between gap-4">
                <span className="text-body-md text-secondary">{row.label}</span>
                <input type="checkbox" defaultChecked={row.on} disabled className="accent-primary" />
              </label>
            ))}
          </div>
        </Card>

        <Card title="Jira" subtitle="Not implemented - these controls are inert" actions={<Chip>Coming soon</Chip>}>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-4">
              <span className="text-body-md text-secondary">Auto-file bugs on failure</span>
              <input type="checkbox" disabled className="accent-primary" />
            </label>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="jira-key" className="text-label-md text-secondary">
                Project key
              </label>
              <select
                id="jira-key"
                disabled
                className="border-muted bg-raised text-body-md text-primary h-9 rounded-lg border px-2.5 focus-visible:outline-none"
              >
                <option>SHOP</option>
                <option>QA</option>
                <option>PLAT</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Quality gate as it appears on a pull request */}
      <div>
        <h2 className="text-label-sm text-tertiary mb-3">
          Quality gate on a pull request{" "}
          <span className="text-quaternary">- illustration, not live data</span>
        </h2>
        <BrowserFrame url="github.com/acme/shopstack/pull/482">
          <div className="p-5">
            <div className="flex items-center gap-2.5">
              <Chip tone="success">
                <GitPullRequest size={11} aria-hidden="true" />
                Open
              </Chip>
              <span className="text-heading-sm text-primary">
                Rename checkout CTA to &ldquo;Place order&rdquo;
              </span>
              <span className="text-body-sm text-quaternary tabular">#482</span>
            </div>

            <div className="border-muted mt-4 overflow-hidden rounded-lg border">
              <div className="border-muted bg-raised border-b px-3.5 py-2.5">
                <p className="text-label-md text-primary">All checks have passed</p>
                <p className="text-caption text-quaternary mt-0.5">2 successful checks</p>
              </div>
              {[
                { name: "Parikshan / e2e-suite", detail: "42/42 passed in 1m 12s" },
                { name: "build / vercel", detail: "Deployed to preview" },
              ].map((check) => (
                <div
                  key={check.name}
                  className="border-muted flex items-center gap-2.5 border-b px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="bg-success-surface text-success grid h-5 w-5 shrink-0 place-items-center rounded-full">
                    <Check size={11} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="text-body-md text-primary">{check.name}</span>
                  <span className="text-body-sm text-tertiary min-w-0 flex-1 truncate">
                    {check.detail}
                  </span>
                  <a
                    href="#"
                    className="text-body-sm text-info shrink-0 hover:underline underline-offset-4"
                  >
                    Details
                  </a>
                </div>
              ))}
            </div>
          </div>
        </BrowserFrame>
      </div>
    </PageBody>
  );
}
