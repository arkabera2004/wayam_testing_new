import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ArrowRight, X, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getCurrentUserOrNull } from "@/lib/auth/functions";
import { createOrganizationFn, inviteMemberFn } from "@/lib/org/functions";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const user = await getCurrentUserOrNull();
    if (!user) throw redirect({ to: "/login" });
  },
  component: OnboardingPage,
});

const STEPS = ["Workspace", "Invite your team", "First project"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const createOrganization = useServerFn(createOrganizationFn);
  const inviteMember = useServerFn(inviteMemberFn);

  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;

  function addInvite() {
    const email = inviteDraft.trim();
    if (email && !invites.includes(email)) {
      setInvites([...invites, email]);
      setInviteDraft("");
    }
  }

  async function handleCreateOrg() {
    setError(null);
    setSubmitting(true);
    try {
      const org = await createOrganization({ data: { name: orgName.trim() } });
      setOrgId(org.id);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvitesContinue() {
    if (!orgId || invites.length === 0) {
      setStep(2);
      return;
    }
    setSubmitting(true);
    // Best-effort: an invite failing shouldn't block onboarding — the org
    // admin can retry from Settings > Members.
    await Promise.allSettled(
      invites.map((email) => inviteMember({ data: { orgId, email, role: "viewer" } })),
    );
    setSubmitting(false);
    setStep(2);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-display text-sm tracking-tight">Parikshan</span>
        </Link>

        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{STEPS[step]}</span>
          </div>
          <Progress value={progress} />
        </div>

        {step === 0 && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Create your workspace</CardTitle>
              <CardDescription>This is where your team's projects and test runs live.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org">Organization name</Label>
                <Input
                  id="org"
                  placeholder="Northwind Labs"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                disabled={!orgName.trim() || submitting}
                onClick={handleCreateOrg}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Invite your team</CardTitle>
              <CardDescription>Optional — you can always invite teammates later from Settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="teammate@company.com"
                  value={inviteDraft}
                  onChange={(e) => setInviteDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())}
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addInvite}
                  disabled={submitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {invites.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {invites.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1 pr-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => setInvites(invites.filter((i) => i !== email))}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                >
                  Skip
                </Button>
                <Button className="flex-1" onClick={handleInvitesContinue} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Add your first project</CardTitle>
              <CardDescription>Connect a repo or a live URL to generate your first test plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={() => navigate({ to: "/projects/new" })}>
                Add your first project <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate({ to: "/dashboard" })}
              >
                I'll do this later
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
