import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getOrgMembersFn,
  inviteMemberFn,
  updateMemberRoleFn,
  updateOrganizationNameFn,
  type PublicMember,
} from "@/lib/org/functions";
import {
  generateApiKeyFn,
  listApiKeysFn,
  revokeApiKeyFn,
  type PublicApiKey,
} from "@/lib/api-keys/functions";

export const Route = createFileRoute("/_app/settings")({
  loader: async ({ context }) => {
    if (!context.org) return null;
    const orgId = context.org.id;
    const [members, apiKeys] = await Promise.all([
      getOrgMembersFn({ data: { orgId } }),
      listApiKeysFn({ data: { orgId } }),
    ]);
    return { members, apiKeys };
  },
  component: SettingsPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SettingsPage() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const router = useRouter();

  const updateOrgName = useServerFn(updateOrganizationNameFn);
  const inviteMember = useServerFn(inviteMemberFn);
  const updateMemberRole = useServerFn(updateMemberRoleFn);
  const generateApiKey = useServerFn(generateApiKeyFn);
  const revokeApiKey = useServerFn(revokeApiKeyFn);

  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [members, setMembers] = useState<PublicMember[]>(data?.members ?? []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [apiKeys, setApiKeys] = useState<PublicApiKey[]>(data?.apiKeys ?? []);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  if (!org || !data) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Finish setting up your workspace to manage settings.
          </p>
          <Button asChild>
            <Link to="/onboarding">Complete onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  async function saveOrgName() {
    if (!orgName.trim()) return;
    try {
      await updateOrgName({ data: { orgId: org!.id, name: orgName.trim() } });
      toast.success("Workspace updated");
      router.invalidate(); // refresh the sidebar's org name
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update workspace");
    }
  }

  async function invite() {
    if (!inviteEmail.trim()) return;
    try {
      await inviteMember({ data: { orgId: org!.id, email: inviteEmail.trim(), role: "viewer" } });
      setMembers((prev) => [
        ...prev,
        { id: inviteEmail, userId: null, name: inviteEmail, email: inviteEmail, role: "viewer", pending: true },
      ]);
      toast.success(`Invited ${inviteEmail}`);
      setInviteEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite");
    }
  }

  async function changeRole(member: PublicMember, role: "admin" | "editor" | "viewer") {
    if (member.pending) return;
    try {
      await updateMemberRole({ data: { orgId: org!.id, membershipId: member.id, role } });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role");
    }
  }

  async function handleGenerateKey() {
    try {
      const created = await generateApiKey({
        data: { orgId: org!.id, name: `Key generated ${new Date().toLocaleDateString()}` },
      });
      setApiKeys((prev) => [
        { id: created.id, name: created.name, keyPrefix: created.keyPrefix, createdAt: created.createdAt, lastUsedAt: null },
        ...prev,
      ]);
      setRevealedKey(created.plaintextKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate API key");
    }
  }

  async function handleRevokeKey(id: string) {
    try {
      await revokeApiKey({ data: { orgId: org!.id, keyId: id } });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast("API key revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke key");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace, members, API keys, and billing.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="api-keys">API keys</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>Basic information about your organization.</CardDescription>
            </CardHeader>
            <CardContent className="max-w-sm space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <Button onClick={saveOrgName}>Save changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite a teammate</CardTitle>
            </CardHeader>
            <CardContent className="flex max-w-md gap-2">
              <Input
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
              />
              <Button onClick={invite}>
                <Plus className="h-4 w-4" /> Invite
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>{members.length} people in this workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {initials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                          {member.pending && (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          disabled={member.pending}
                          onValueChange={(role) =>
                            changeRole(member, role as "admin" | "editor" | "viewer")
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">API keys</CardTitle>
                <CardDescription>Used to authenticate CI and CLI requests.</CardDescription>
              </div>
              <Button size="sm" onClick={handleGenerateKey}>
                <KeyRound className="h-4 w-4" /> Generate key
              </Button>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No API keys yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {key.keyPrefix}…
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(key.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                        </TableCell>
                        <TableCell className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRevokeKey(key.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Current plan</CardTitle>
                <Badge className="bg-primary/15 text-primary">Team</Badge>
              </div>
              <CardDescription>$49/mo · 5,000 test executions included</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* INTEGRATION POINT: billing/usage isn't in the data model yet
                  — no subscriptions/usage tables exist. These numbers are
                  still illustrative. */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Test executions</span>
                  <span className="text-muted-foreground">3,240 / 5,000</span>
                </div>
                <Progress value={64.8} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Projects</span>
                  <span className="text-muted-foreground">3 / Unlimited</span>
                </div>
                <Progress value={15} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline">Change plan</Button>
                <Button variant="ghost">View invoices</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!revealedKey} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key generated</DialogTitle>
            <DialogDescription>
              Copy this now — for your security, it won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 p-3 font-mono text-sm">
            <span className="flex-1 truncate">{revealedKey}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (revealedKey) navigator.clipboard?.writeText(revealedKey);
                toast("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
