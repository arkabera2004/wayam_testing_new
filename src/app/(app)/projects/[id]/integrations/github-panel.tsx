"use client";

import { useState } from "react";
import { Check, ExternalLink, Github, Loader2, RefreshCw, Unlink } from "lucide-react";

import { Button, Card, Chip } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

type Repo = {
  fullName: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  language: string | null;
};

export function GithubPanel({
  connected,
  username,
  connectedAtLabel,
  linkedRepo,
}: {
  connected: boolean;
  username: string | null;
  connectedAtLabel: string | null;
  linkedRepo: string | null;
}) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(connected);
  const [user, setUser] = useState(username);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [repos, setRepos] = useState<Repo[] | null>(null);

  async function connect() {
    if (!token.trim()) {
      toast({ tone: "error", title: "Token required", body: "Paste a GitHub personal access token." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Could not connect", body: data.error });
        return;
      }
      setIsConnected(true);
      setUser(data.username);
      setToken(""); // Do not keep the secret in component state after use.
      toast({ tone: "success", title: "GitHub connected", body: `Authenticated as ${data.username}.` });
    } catch {
      toast({ tone: "error", title: "Could not connect", body: "The request failed." });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/integrations/github", { method: "DELETE" });
      setIsConnected(false);
      setUser(null);
      setRepos(null);
      toast({ tone: "info", title: "GitHub disconnected", body: "The stored token was deleted." });
    } finally {
      setBusy(false);
    }
  }

  async function loadRepos() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/github/repos");
      const data = await res.json();
      if (!res.ok) {
        toast({ tone: "error", title: "Could not load repositories", body: data.error });
        return;
      }
      setRepos(data.repos);
      toast({ tone: "success", title: `${data.repos.length} repositories loaded` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="GitHub"
      subtitle={
        isConnected
          ? `Connected as ${user}${connectedAtLabel ? ` · ${connectedAtLabel}` : ""}`
          : "Connect an account to read repositories and CI results"
      }
      actions={
        isConnected ? (
          <>
            <Chip tone="success">
              <Check size={11} aria-hidden="true" />
              Connected
            </Chip>
            <Button size="sm" icon={RefreshCw} onClick={loadRepos} disabled={busy}>
              Load repositories
            </Button>
            <Button size="sm" variant="secondary" icon={Unlink} onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
          </>
        ) : (
          <Chip>Not connected</Chip>
        )
      }
    >
      {isConnected ? (
        <div className="flex flex-col gap-3">
          <p className="text-body-md text-secondary">
            Linked repository for this project:{" "}
            {linkedRepo ? (
              <a
                href={`https://github.com/${linkedRepo}`}
                target="_blank"
                rel="noreferrer"
                className="text-info hover:underline underline-offset-4"
              >
                {linkedRepo} <ExternalLink size={11} className="inline" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-tertiary">none set - add a repository URL in project settings.</span>
            )}
          </p>

          {repos && (
            <div className="border-muted max-h-72 overflow-auto rounded-lg border">
              {repos.map((r) => (
                <div key={r.fullName} className="border-muted flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0">
                  <Github size={13} className="text-tertiary shrink-0" aria-hidden="true" />
                  <a
                    href={r.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-body-md text-primary shrink-0 hover:underline underline-offset-4"
                  >
                    {r.fullName}
                  </a>
                  {r.private && <Chip>Private</Chip>}
                  {r.language && <Chip>{r.language}</Chip>}
                  <span className="text-body-sm text-tertiary min-w-0 flex-1 truncate">{r.description ?? ""}</span>
                  <span className="text-caption text-quaternary shrink-0">{r.defaultBranch}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-md text-tertiary">
            Paste a personal access token with <code className="text-secondary">repo</code> scope. It is
            encrypted before it is stored and never displayed again.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              aria-label="GitHub personal access token"
              autoComplete="off"
              className="border-muted bg-raised text-body-md text-primary h-9 min-w-64 flex-1 rounded-lg border px-2.5 focus-visible:outline-none"
            />
            <Button variant="primary" icon={busy ? Loader2 : Github} onClick={connect} disabled={busy}>
              {busy ? "Verifying…" : "Connect GitHub"}
            </Button>
          </div>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=Parikshan"
            target="_blank"
            rel="noreferrer"
            className="text-body-sm text-info hover:underline underline-offset-4"
          >
            Create a token on GitHub <ExternalLink size={11} className="inline" aria-hidden="true" />
          </a>
        </div>
      )}
    </Card>
  );
}
