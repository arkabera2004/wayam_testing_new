import "server-only";

import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Builds and restarts the application being tested.
 *
 * This is what makes a fix verdict mean anything. While the storefront lived
 * inside Parikshan, a proposed source change could not be built without
 * restarting the process doing the verifying - so the suite was re-run against
 * code the change had never reached, and every correct fix was rejected with a
 * confident explanation. Separating the two processes is what lets a baseline,
 * a change and a re-run be three different states of the same application.
 *
 * Deliberately narrow: it drives one configured directory with one configured
 * command. It does not accept a command from a request, because "rebuild the
 * app" would otherwise be a way to run anything at all.
 */

export type AppUnderTest = {
  /** Directory of the application, relative to the repository root. */
  dir: string;
  /** Where it serves once started. */
  baseUrl: string;
  port: number;
};

/** The only application this may drive. */
export const SHOPSTACK: AppUnderTest = {
  dir: "apps/shopstack",
  baseUrl: "http://localhost:4000/demo/shopstack",
  port: 4000,
};

const BUILD_TIMEOUT_MS = 180_000;
const READY_TIMEOUT_MS = 60_000;

function run(command: string, args: string[], cwd: string, timeoutMs: number): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const kill = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(kill);
      resolve({ ok: code === 0, output: output.slice(-4000) });
    });
    child.on("error", (err) => {
      clearTimeout(kill);
      resolve({ ok: false, output: String(err) });
    });
  });
}

async function isUp(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(baseUrl, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function stop(app: AppUnderTest): Promise<void> {
  // Matched on the port so only the intended server is taken down.
  await run("bash", ["-lc", `lsof -ti:${app.port} | xargs kill -9 2>/dev/null || true`], process.cwd(), 15_000);
  await waitUntil(async () => !(await isUp(app.baseUrl)), 15_000);
}

async function start(app: AppUnderTest, repoRoot: string): Promise<boolean> {
  const cwd = path.join(repoRoot, app.dir);
  // Detached, because it must outlive the request that started it.
  const child = spawn("npx", ["next", "start", "-p", String(app.port)], {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return waitUntil(() => isUp(app.baseUrl), READY_TIMEOUT_MS);
}

export type RebuildResult = { ok: boolean; stage: "build" | "start" | "done"; output: string };

/**
 * Rebuilds the application from whatever is currently on disk and brings it
 * back up. The caller is responsible for what is on disk; this only guarantees
 * that what is running afterwards was built from it.
 */
export async function rebuildAndRestart(app: AppUnderTest, repoRoot: string): Promise<RebuildResult> {
  const build = await run("npx", ["next", "build"], path.join(repoRoot, app.dir), BUILD_TIMEOUT_MS);
  if (!build.ok) return { ok: false, stage: "build", output: build.output };

  await stop(app);
  const started = await start(app, repoRoot);
  if (!started) return { ok: false, stage: "start", output: "The application did not come back up after rebuilding." };

  return { ok: true, stage: "done", output: build.output.slice(-500) };
}

export async function ensureRunning(app: AppUnderTest, repoRoot: string): Promise<boolean> {
  if (await isUp(app.baseUrl)) return true;
  return start(app, repoRoot);
}
