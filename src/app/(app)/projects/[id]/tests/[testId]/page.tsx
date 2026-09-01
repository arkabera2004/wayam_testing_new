"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download } from "lucide-react";

import {
  Button,
  Card,
  Chip,
  CodeBlock,
  StatusBadge,
  Table,
  Td,
  Th,
  cn,
} from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import {
  generatedTests,
  runs,
  starTestCode,
  testPlan,
  testVersions,
} from "@/lib/demo-data";
import { copyText } from "@/lib/copy";
import { useToast } from "@/components/ui/toast";

const TABS = ["Code", "Steps", "History", "Settings"] as const;

export default function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string; testId: string }>;
}) {
  const { id, testId } = use(params);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Code");
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const test = generatedTests.find((t) => t.id === testId) ?? generatedTests[0];
  const planCase = testPlan.find((c) => c.id === testId) ?? testPlan[0];

  const copy = async () => {
    if (await copyText(starTestCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      return;
    }
    toast({
      tone: "error",
      title: "Could not copy",
      body: "Your browser blocked clipboard access — select the text and copy manually.",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header ---- */}
      <header className="border-muted flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-heading-md text-primary">{test.name}</h1>
            <StatusBadge status={test.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip>{test.journey}</Chip>
            {test.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <ActionButton icon="externalLink" title="Exported to repo" body="A pull request was opened against acme/shopstack.">Export</ActionButton>
          <ActionButton variant="primary" icon="play" title="Test queued" body="Running on Chromium.">
            Run this test
          </ActionButton>
        </div>
      </header>

      {/* ---- Tabs ---- */}
      <div className="border-muted flex gap-1 border-b px-5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "true" : undefined}
            className={cn(
              "text-label-md -mb-px border-b-2 px-3 py-2.5 transition-colors duration-[170ms]",
              tab === t
                ? "border-action-primary text-primary"
                : "text-tertiary hover:text-secondary border-transparent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---- Body ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "Code" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <Card padded={false}>
              <div className="border-muted flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <span className="text-label-sm text-tertiary">
                  tests/checkout.spec.ts
                </span>
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" icon={copied ? Check : Copy} onClick={copy}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <ActionButton size="sm" icon="download" title="Spec downloaded">
                    Download
                  </ActionButton>
                  <ActionButton size="sm" icon="externalLink" title="Opening in repo" body="acme/shopstack · tests/checkout.spec.ts">
                    Open in repo
                  </ActionButton>
                  <ActionButton size="sm" icon="settings" title="Editor coming soon" body="Inline spec editing is not part of this build.">
                    Edit
                  </ActionButton>
                </div>
              </div>
              <div className="p-4">
                <CodeBlock code={starTestCode} language="ts" />
              </div>
            </Card>

            <Card title="Versions" padded={false}>
              <ul className="flex flex-col">
                {testVersions.map((v, i) => (
                  <li
                    key={v.version}
                    className={cn("border-muted px-4 py-3", i > 0 && "border-t")}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-label-md text-primary">{v.version}</span>
                      <span className="text-caption text-quaternary">{v.when}</span>
                    </div>
                    <p className="text-body-sm text-tertiary mt-1">{v.note}</p>
                    <p className="text-caption text-quaternary mt-0.5">by {v.author}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "Steps" && (
          <Card
            title="Plain-language steps"
            subtitle="The approved scenario this code implements"
          >
            <p className="text-body-md text-tertiary">
              <span className="text-quaternary">Expect:</span> {planCase.expectation}
            </p>
            <ol className="border-muted mt-4 flex flex-col gap-2.5 border-l pl-4">
              {planCase.steps.map((s, i) => (
                <li key={i} className="text-body-md text-secondary flex gap-2.5">
                  <span className="text-quaternary tabular shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {tab === "History" && (
          <Card title="Run history" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Run</Th>
                  <Th>When</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Duration</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-raised transition-colors duration-[170ms]">
                    <Td>
                      <Link
                        href={`/projects/${id}/runs/${run.id}`}
                        className="text-label-md text-primary tabular"
                      >
                        #{run.id}
                      </Link>
                    </Td>
                    <Td>{run.started}</Td>
                    <Td>
                      <StatusBadge status={run.status} />
                    </Td>
                    <Td className="tabular text-right">{run.duration}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === "Settings" && (
          <Card title="Test settings">
            <div className="flex flex-col gap-4">
              {[
                { label: "Run on every pull request", on: true },
                { label: "Include in smoke suite", on: true },
                { label: "Allow locator self-healing", on: true },
                { label: "Retry once on failure", on: false },
              ].map((row) => (
                <label key={row.label} className="flex items-center justify-between gap-4">
                  <span className="text-body-md text-secondary">{row.label}</span>
                  <input type="checkbox" defaultChecked={row.on} className="accent-primary" />
                </label>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
