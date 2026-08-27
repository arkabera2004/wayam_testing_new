import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Github, Slack, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  listIntegrationsFn,
  toggleIntegrationFn,
  updateIntegrationConfigFn,
  type PublicIntegration,
} from "@/lib/integrations/functions";

export const Route = createFileRoute("/_app/integrations")({
  loader: async ({ context }): Promise<PublicIntegration[]> => {
    if (!context.org) return [];
    return listIntegrationsFn({ data: { orgId: context.org.id } });
  },
  component: IntegrationsPage,
});

const PROVIDER_META: Record<
  PublicIntegration["provider"],
  { name: string; blurb: string; icon: typeof Github }
> = {
  github: {
    name: "GitHub",
    blurb: "Connect a repository and run the suite on every pull request.",
    icon: Github,
  },
  slack: {
    name: "Slack",
    blurb: "Post a message to a channel whenever a run fails.",
    icon: Slack,
  },
  jira: {
    name: "Jira",
    blurb: "Automatically file a bug ticket for each new failing test.",
    icon: Ticket,
  },
};

function detailFor(integration: PublicIntegration): string {
  if (!integration.connected) return "Not yet connected";
  const config = integration.config;
  if (integration.provider === "github") return (config["repo"] as string | undefined) ?? "No repository linked yet";
  if (integration.provider === "slack") return (config["channel"] as string | undefined) ?? "No channel selected yet";
  return (config["projectKey"] as string | undefined) ?? "No project selected yet";
}

function IntegrationsPage() {
  const { org } = Route.useRouteContext();
  const initial = Route.useLoaderData();
  const toggleIntegration = useServerFn(toggleIntegrationFn);
  const updateConfig = useServerFn(updateIntegrationConfigFn);

  const [integrations, setIntegrations] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);

  async function handleToggle(provider: PublicIntegration["provider"]) {
    if (!org) return;
    setPending(provider);
    try {
      const updated = await toggleIntegration({ data: { orgId: org.id, provider } });
      setIntegrations((prev) => prev.map((i) => (i.provider === provider ? updated : i)));
      toast(updated.connected ? `Connected ${PROVIDER_META[provider].name}` : `Disconnected ${PROVIDER_META[provider].name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update integration");
    } finally {
      setPending(null);
    }
  }

  async function handleRunOnPrChange(checked: boolean) {
    if (!org) return;
    const github = integrations.find((i) => i.provider === "github");
    if (!github) return;
    const nextConfig = { ...github.config, runOnPr: checked };
    // Optimistic — this is a low-stakes toggle, no need to block the UI on it.
    setIntegrations((prev) =>
      prev.map((i) => (i.provider === "github" ? { ...i, config: nextConfig } : i)),
    );
    try {
      await updateConfig({ data: { orgId: org.id, provider: "github", config: nextConfig } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update setting");
    }
  }

  const github = integrations.find((i) => i.provider === "github");
  const runOnPr = (github?.config["runOnPr"] as boolean | undefined) ?? true;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect the tools your team already uses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => {
          const meta = PROVIDER_META[integration.provider];
          const Icon = meta.icon;
          return (
            <Card key={integration.provider} className="border-border/60">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{meta.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={
                        integration.connected
                          ? "mt-1 border-success/30 bg-success/15 text-success"
                          : "mt-1"
                      }
                    >
                      {integration.connected ? "Connected" : "Not yet connected"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription>{meta.blurb}</CardDescription>
                {integration.connected && (
                  <p className="text-xs text-muted-foreground">{detailFor(integration)}</p>
                )}
                {integration.provider === "github" && integration.connected && (
                  <div className="flex items-center justify-between rounded-md border border-border/60 p-2.5">
                    <Label htmlFor="run-on-pr" className="text-sm font-normal">
                      Run suite on every pull request
                    </Label>
                    <Switch id="run-on-pr" checked={runOnPr} onCheckedChange={handleRunOnPrChange} />
                  </div>
                )}
                <Button
                  size="sm"
                  variant={integration.connected ? "outline" : "default"}
                  disabled={!org || pending === integration.provider}
                  onClick={() => handleToggle(integration.provider)}
                >
                  {integration.connected ? "Disconnect" : "Connect"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
