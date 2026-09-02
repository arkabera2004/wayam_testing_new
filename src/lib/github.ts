import "server-only";

const API = "https://api.github.com";

export type GithubUser = { login: string; name: string | null; avatarUrl: string; htmlUrl: string };
export type GithubRepo = {
  fullName: string;
  htmlUrl: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  updatedAt: string | null;
  language: string | null;
};
export type GithubWorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  headBranch: string | null;
  createdAt: string | null;
};

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // GitHub puts the useful part in `message`; surface it instead of a bare status.
    const detail = await res.json().catch(() => null);
    const message = (detail as { message?: string } | null)?.message ?? res.statusText;
    if (res.status === 401) throw new Error("GitHub rejected the token. It may be expired or revoked.");
    if (res.status === 403 && message.includes("rate limit")) throw new Error("GitHub rate limit reached. Try again shortly.");
    throw new Error(`GitHub: ${message}`);
  }
  return (await res.json()) as T;
}

/** Verifies a token and returns who it belongs to. Used before anything is stored. */
export async function verifyToken(token: string): Promise<GithubUser> {
  const u = await gh<{ login: string; name: string | null; avatar_url: string; html_url: string }>(token, "/user");
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url, htmlUrl: u.html_url };
}

export async function listRepos(token: string, limit = 30): Promise<GithubRepo[]> {
  const rows = await gh<
    Array<{
      full_name: string; html_url: string; private: boolean; default_branch: string;
      description: string | null; updated_at: string | null; language: string | null;
    }>
  >(token, `/user/repos?sort=updated&per_page=${Math.min(limit, 100)}`);
  return rows.map((r) => ({
    fullName: r.full_name, htmlUrl: r.html_url, private: r.private,
    defaultBranch: r.default_branch, description: r.description,
    updatedAt: r.updated_at, language: r.language,
  }));
}

export async function getRepo(token: string, fullName: string): Promise<GithubRepo> {
  const r = await gh<{
    full_name: string; html_url: string; private: boolean; default_branch: string;
    description: string | null; updated_at: string | null; language: string | null;
  }>(token, `/repos/${fullName}`);
  return {
    fullName: r.full_name, htmlUrl: r.html_url, private: r.private,
    defaultBranch: r.default_branch, description: r.description,
    updatedAt: r.updated_at, language: r.language,
  };
}

/** Recent Actions runs for the linked repo — real CI signal for the release gate. */
export async function listWorkflowRuns(token: string, fullName: string, limit = 10): Promise<GithubWorkflowRun[]> {
  const d = await gh<{
    workflow_runs: Array<{
      id: number; name: string; status: string; conclusion: string | null;
      html_url: string; head_branch: string | null; created_at: string | null;
    }>;
  }>(token, `/repos/${fullName}/actions/runs?per_page=${Math.min(limit, 100)}`);
  return d.workflow_runs.map((r) => ({
    id: r.id, name: r.name, status: r.status, conclusion: r.conclusion,
    htmlUrl: r.html_url, headBranch: r.head_branch, createdAt: r.created_at,
  }));
}

/** Parses "https://github.com/owner/repo(.git)" into "owner/repo". */
export function repoFullName(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/* ---- Writing specs back to the repository ---- */

type Ref = { object: { sha: string } };

/**
 * Commits the generated specs onto a fresh branch and opens a pull request,
 * so the export is reviewable rather than pushed straight at the default
 * branch. Existing files are updated in place (the Contents API needs the
 * current blob sha to do that), new ones are created.
 */
export async function exportSpecsToRepo(
  token: string,
  fullName: string,
  files: Array<{ path: string; content: string }>,
  opts: { branch: string; title: string; body: string },
): Promise<{ prUrl: string; branch: string; fileCount: number }> {
  const repo = await getRepo(token, fullName);

  const base = await gh<Ref>(token, `/repos/${fullName}/git/ref/heads/${repo.defaultBranch}`);
  await gh(token, `/repos/${fullName}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${opts.branch}`, sha: base.object.sha }),
  });

  for (const file of files) {
    // A file already on the branch needs its sha; absent means "create".
    let sha: string | undefined;
    try {
      const existing = await gh<{ sha: string }>(
        token,
        `/repos/${fullName}/contents/${encodeURI(file.path)}?ref=${opts.branch}`,
      );
      sha = existing.sha;
    } catch {
      sha = undefined;
    }

    await gh(token, `/repos/${fullName}/contents/${encodeURI(file.path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Add Parikshan spec ${file.path}`,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch: opts.branch,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  const pr = await gh<{ html_url: string }>(token, `/repos/${fullName}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: opts.title, head: opts.branch, base: repo.defaultBranch, body: opts.body }),
  });

  return { prUrl: pr.html_url, branch: opts.branch, fileCount: files.length };
}
