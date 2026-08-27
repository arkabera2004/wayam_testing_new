import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Github, Slack, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { integrations as seedIntegrations } from "@/features/data/seed";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
});

const ICONS: Record<string, typeof Github> = {
  github: Github,
  slack: Slack,
  jira: Ticket,
};

function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(seedIntegrations);
  const [runOnPr, setRunOnPr] = useState(true);

  function toggle(id: string) {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? {
              ...integration,
              connected: !integration.connected,
              detail: integration.connected ? "Not yet connected" : integration.detail,
            }
          : integration,
      ),
    );
    const target = integrations.find((i) => i.id === id);
    toast(target?.connected ? `Disconnected ${target.name}` : `Connected ${target?.name}`);
  }

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
          const Icon = ICONS[integration.id] ?? Github;
          return (
            <Card key={integration.id} className="border-border/60">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{integration.name}</CardTitle>
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
                <CardDescription>{integration.blurb}</CardDescription>
                {integration.connected && (
                  <p className="text-xs text-muted-foreground">{integration.detail}</p>
                )}
                {integration.id === "github" && integration.connected && (
                  <div className="flex items-center justify-between rounded-md border border-border/60 p-2.5">
                    <Label htmlFor="run-on-pr" className="text-sm font-normal">
                      Run suite on every pull request
                    </Label>
                    <Switch id="run-on-pr" checked={runOnPr} onCheckedChange={setRunOnPr} />
                  </div>
                )}
                <Button
                  size="sm"
                  variant={integration.connected ? "outline" : "default"}
                  onClick={() => toggle(integration.id)}
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
