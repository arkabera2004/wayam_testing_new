import "server-only";

/**
 * Imports a public repository without any credentials.
 *
 * Two API calls list the tree; file contents come from raw.githubusercontent,
 * which is not the API and so does not spend the anonymous rate limit. That
 * keeps a whole repository well inside the 60 requests an hour an unauthorised
 * caller gets, no matter how many files it has.
 */
const API = process.env.GITHUB_API_URL ?? "https://api.github.com";
const RAW = process.env.GITHUB_RAW_URL ?? "https://raw.githubusercontent.com";

/** Bounds, so one enormous repository cannot exhaust memory or the database. */
const MAX_FILES = 4000;
const MAX_STORED = 400;
const MAX_FILE_BYTES = 96_000;

const SOURCE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|rb|go|java|kt|php|cs|cshtml|razor|rs|html?|erb|blade\.php)$/i;
/** Not source, but how a JavaScript project names its stack. */
const MANIFEST = /(?:^|\/)package\.json$/i;

const IGNORED =
  /(^|\/)(node_modules|\.git|\.next|dist|build|out|vendor|coverage|__pycache__|\.venv)\//i;

export type RepoRef = { owner: string; repo: string };

/** Accepts the forms people actually paste. */
export function parseRepoUrl(input: string): RepoRef | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m =
    trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)/i) ??
    trimmed.match(/^git@github\.com:([^/\s]+)\/([^/\s]+)$/i) ??
    trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { message?: string } | null;
    const message = detail?.message ?? res.statusText;
    if (res.status === 404) {
      throw new Error("Repository not found. It must exist and be public - private repos cannot be imported without credentials.");
    }
    if (res.status === 403 && /rate limit/i.test(message)) {
      throw new Error("GitHub's anonymous rate limit is exhausted. Try again in a few minutes.");
    }
    throw new Error(`GitHub: ${message}`);
  }
  return (await res.json()) as T;
}

export type ImportedFile = { path: string; sizeBytes: number; sha: string; content: string | null };

export type RepoImport = {
  owner: string;
  repo: string;
  ref: string;
  commitSha: string;
  files: ImportedFile[];
  fileCount: number;
  truncated: boolean;
  framework: string | null;
};

/**
 * Names the stack from the files present, rather than guessing from one marker.
 *
 * The Next.js branches require a Next.js marker as well as the directory
 * shape. A `pages/` folder full of components is an ordinary way to organise a
 * React app and says nothing about the router: catchmail keeps its screens in
 * `frontend/src/pages/` and was reported as "Next.js (Pages Router)" when it
 * is Vite and React Router. A directory name is not a framework.
 */
function detectFramework(paths: string[], files?: ImportedFile[]): string | null {
  const has = (re: RegExp) => paths.some((p) => re.test(p));

  /** Dependencies declared by any package.json in the tree. */
  const deps = new Set<string>();
  for (const f of files ?? []) {
    if (!/(?:^|\/)package\.json$/.test(f.path) || !f.content) continue;
    try {
      const pkg = JSON.parse(f.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) deps.add(d);
    } catch {
      // A package.json that will not parse tells us nothing. The path checks
      // below still apply.
    }
  }

  const isNext = deps.has("next") || has(/(?:^|\/)next\.config\.[mc]?[jt]s$/);

  if (isNext && has(/(?:^|\/)app\/.*\/(page|route)\.(tsx?|jsx?)$/)) return "Next.js (App Router)";
  if (isNext && has(/(?:^|\/)pages\/.*\.(tsx?|jsx?)$/)) return "Next.js (Pages Router)";

  // The router matters more than the bundler: what a test needs to know is how
  // the application decides which screen to show.
  if (deps.has("react-router-dom") || deps.has("react-router")) {
    return has(/(?:^|\/)vite\.config\.[mc]?[jt]s$/) || deps.has("vite")
      ? "React (Vite + React Router)"
      : "React (React Router)";
  }
  if (has(/(?:^|\/)vite\.config\.[mc]?[jt]s$/) || deps.has("vite")) return "Vite";
  if (has(/^src\/routes\/.*\+page\.svelte$/)) return "SvelteKit";
  if (has(/^(src\/)?app\/.*\.vue$/) || has(/^nuxt\.config\./)) return "Nuxt";
  if (has(/^angular\.json$/)) return "Angular";
  if (has(/Controller\.cs$/) || has(/\.cshtml$/)) return "ASP.NET MVC";
  if (has(/\.csproj$/)) return ".NET";
  if (has(/(?:^|\/)requirements\.txt$/) && has(/\.py$/)) return "Python";
  if (has(/(?:^|\/)Gemfile$/)) return "Ruby";
  if (has(/^manage\.py$/)) return "Django";
  if (has(/^(app|main)\.py$/)) return "Python";
  if (has(/^go\.mod$/)) return "Go";
  if (has(/package\.json$/)) return "JavaScript";
  return null;
}

export async function importPublicRepo(
  url: string,
  onProgress?: (phase: "listing" | "reading" | "analysing", message: string, counts?: { done: number; total: number }) => void,
): Promise<RepoImport> {
  const ref = parseRepoUrl(url);
  if (!ref) throw new Error("That does not look like a GitHub repository URL.");
  const { owner, repo } = ref;

  onProgress?.("listing", `Reading ${owner}/${repo}`);
  const meta = await api<{ default_branch: string }>(`/repos/${owner}/${repo}`);
  const branch = meta.default_branch;

  const tree = await api<{
    sha: string;
    truncated: boolean;
    tree: Array<{ path: string; type: string; size?: number; sha: string }>;
  }>(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);

  const blobs = tree.tree
    .filter((n) => n.type === "blob" && !IGNORED.test(`/${n.path}`))
    .slice(0, MAX_FILES);

  // Contents are only worth keeping for source files small enough to read -
  // plus every package.json, which is not source but is how the stack names
  // itself. Without it the framework had to be guessed from directory names,
  // and a `pages/` folder was read as Next.js in an app that never used it.
  const wanted = blobs
    .filter(
      (n) =>
        (SOURCE.test(n.path) || MANIFEST.test(n.path)) && (n.size ?? 0) <= MAX_FILE_BYTES,
    )
    .slice(0, MAX_STORED);
  const wantedPaths = new Set(wanted.map((n) => n.path));

  onProgress?.("reading", `Reading ${wanted.length} source files`, { done: 0, total: wanted.length });

  const contents = new Map<string, string>();
  // Fetched in batches: one request per file, but bounded and parallel enough
  // to stay quick without opening hundreds of sockets at once.
  for (let i = 0; i < wanted.length; i += 20) {
    const batch = wanted.slice(i, i + 20);
    await Promise.all(
      batch.map(async (n) => {
        try {
          const res = await fetch(`${RAW}/${owner}/${repo}/${branch}/${n.path}`, { cache: "no-store" });
          if (res.ok) contents.set(n.path, await res.text());
        } catch {
          /* A single unreadable file should not fail the whole import. */
        }
      }),
    );
    onProgress?.("reading", `Read ${Math.min(i + batch.length, wanted.length)} of ${wanted.length} files`, {
      done: Math.min(i + batch.length, wanted.length),
      total: wanted.length,
    });
  }

  onProgress?.("analysing", "Deriving routes and endpoints");

  const files: ImportedFile[] = blobs.map((n) => ({
    path: n.path,
    sizeBytes: n.size ?? 0,
    sha: n.sha,
    content: wantedPaths.has(n.path) ? (contents.get(n.path) ?? null) : null,
  }));

  return {
    owner,
    repo,
    ref: branch,
    commitSha: tree.sha,
    fileCount: blobs.length,
    truncated: Boolean(tree.truncated) || blobs.length >= MAX_FILES,
    framework: detectFramework(
      blobs.map((b) => b.path),
      files,
    ),
    files,
  };
}
