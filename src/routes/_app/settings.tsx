import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { members as seedMembers } from "@/features/data/seed";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const API_KEYS = [
  { id: "key_1", name: "CI pipeline", created: "Aug 12, 2026", lastUsed: "2 hours ago" },
  { id: "key_2", name: "Local dev", created: "Jul 30, 2026", lastUsed: "5 days ago" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SettingsPage() {
  const [orgName, setOrgName] = useState("Northwind Labs");
  const [members, setMembers] = useState(seedMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [apiKeys, setApiKeys] = useState(API_KEYS);

  function invite() {
    if (!inviteEmail.trim()) return;
    setMembers((prev) => [
      ...prev,
      { name: inviteEmail.split("@")[0] ?? inviteEmail, email: inviteEmail, role: "Viewer" },
    ]);
    toast.success(`Invited ${inviteEmail}`);
    setInviteEmail("");
  }

  function revokeKey(id: string) {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    toast("API key revoked");
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
              <Button onClick={() => toast.success("Workspace updated")}>Save changes</Button>
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
                    <TableRow key={member.email}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {initials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        <Select
                          defaultValue={member.role}
                          onValueChange={(role) =>
                            setMembers((prev) =>
                              prev.map((m) => (m.email === member.email ? { ...m, role } : m)),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Editor">Editor</SelectItem>
                            <SelectItem value="Viewer">Viewer</SelectItem>
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
              <Button
                size="sm"
                onClick={() => {
                  setApiKeys((prev) => [
                    ...prev,
                    {
                      id: `key_${prev.length + 1}`,
                      name: "New key",
                      created: "Just now",
                      lastUsed: "Never",
                    },
                  ]);
                  toast.success("API key generated");
                }}
              >
                <KeyRound className="h-4 w-4" /> Generate key
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="text-muted-foreground">{key.created}</TableCell>
                      <TableCell className="text-muted-foreground">{key.lastUsed}</TableCell>
                      <TableCell className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard?.writeText(`pk_live_${key.id}`);
                            toast("Copied to clipboard");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => revokeKey(key.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    </div>
  );
}
