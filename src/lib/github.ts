import "server-only";

/**
 * Overridable so the export flow can be exercised end to end against a stub
 * of the GitHub API. Unset in normal use, which is the real thing.
 */
const API = process.env.GITHUB_API_URL ?? "https://api.github.com";

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
      ...(init?.body ? { "content-type": "application/json" } : {}),
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

/** Recent Actions runs for the linked repo - real CI signal for the release gate. */
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

/** Raised when the specs already match the branch, so there is nothing to open a PR about. */
export class NothingToExportError extends Error {
  constructor() {
    super("The repository already has these specs, so there is nothing to export.");
    this.name = "NothingToExportError";
  }
}

/**
 * Commits the generated specs onto a fresh branch and opens a pull request,
 * so the export is reviewable rather than pushed straight at the default
 * branch.
 *
 * Built on the Git Data API rather than the Contents API. Contents writes one
 * commit per file, so a ten-spec export made ten commits and twenty-odd round
 * trips, and each file needed its current blob sha fetched first just to know
 * whether it was a create or an update. Blobs plus a tree plus one commit is a
 * single commit, far fewer requests, and create-or-update falls out of the
 * tree merge for free.
 *
 * The branch is created only after the commit exists and only when the tree
 * actually differs, so a failed or redundant export leaves no branch behind.
 */
export async function exportSpecsToRepo(
  token: string,
  fullName: string,
  files: Array<{ path: string; content: string }>,
  opts: { branch: string; title: string; body: string },
): Promise<{ prUrl: string; branch: string; fileCount: number; commitSha: string }> {
  const repo = await getRepo(token, fullName);

  let base: Ref;
  try {
    base = await gh<Ref>(token, `/repos/${fullName}/git/ref/heads/${repo.defaultBranch}`);
  } catch {
    // A repository with no commits has no branch ref to build on.
    throw new Error(
      `${fullName} has no commits on ${repo.defaultBranch}, so there is nothing to branch from.`,
    );
  }
  const baseSha = base.object.sha;

  const baseCommit = await gh<{ tree: { sha: string } }>(
    token,
    `/repos/${fullName}/git/commits/${baseSha}`,
  );

  // Blobs first. Independent of each other, so they go up together.
  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = await gh<{ sha: string }>(token, `/repos/${fullName}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64",
        }),
      });
      return { path: file.path, sha: blob.sha };
    }),
  );

  const tree = await gh<{ sha: string }>(token, `/repos/${fullName}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
    }),
  });

  // An identical tree means every spec already matches the branch. Opening a
  // PR now would fail with "No commits between" and strand a branch, so stop
  // here and say why.
  if (tree.sha === baseCommit.tree.sha) throw new NothingToExportError();

  const commit = await gh<{ sha: string }>(token, `/repos/${fullName}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `${opts.title}\n\n${opts.body}`,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });

  await gh(token, `/repos/${fullName}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${opts.branch}`, sha: commit.sha }),
  });

  try {
    const pr = await gh<{ html_url: string }>(token, `/repos/${fullName}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: opts.title,
        head: opts.branch,
        base: repo.defaultBranch,
        body: opts.body,
      }),
    });
    return { prUrl: pr.html_url, branch: opts.branch, fileCount: files.length, commitSha: commit.sha };
  } catch (error) {
    // Do not leave a branch nobody asked for when the PR could not be opened.
    await gh(token, `/repos/${fullName}/git/refs/heads/${opts.branch}`, { method: "DELETE" }).catch(
      () => {},
    );
    throw error;
  }
}
