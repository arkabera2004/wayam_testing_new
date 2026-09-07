import "server-only";

import { spawn } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { AppDriver, AppUnderTest, RebuildResult } from "@/lib/app-under-test";
import { childEnv } from "@/lib/child-env";

/**
 * Runs the application under test inside a container.
 *
 * The local driver is right for an application shipped in this repository and
 * known to be safe. It is the wrong answer for a repository someone pasted
 * into the import box, whose build runs whatever its own package.json says to
 * run, as this user, with this machine's filesystem and network. This driver
 * is for that case.
 *
 * Four properties, and each one is a thing the local driver cannot offer:
 *
 *  - The build context is assembled, not mounted. Only the application's own
 *    directory goes in, plus a manifest the driver writes. Parikshan's source,
 *    its .env.local and its node_modules are not in the image, so a build
 *    cannot read them however curious it is.
 *
 *  - Nothing is bind-mounted, so a build cannot write back to the host. What
 *    comes out is what the container serves over its published port.
 *
 *  - Egress is denied by default. A container is attached to an internal
 *    network with no route off the machine, so a postinstall script cannot
 *    reach the internet, and - just as important - cannot reach the Neon
 *    database whose connection string lives on the host.
 *
 *  - Resources are capped and the container is disposable. One container per
 *    application, replaced on every rebuild, so a wedged process is bounded
 *    rather than accumulating.
 */

const BUILD_TIMEOUT_MS = 600_000;
const READY_TIMEOUT_MS = 90_000;
const DOCKER_TIMEOUT_MS = 60_000;

/** Caps, so a runaway build cannot take the machine down with it. */
const CPU_LIMIT = "2";
const MEMORY_LIMIT = "2g";
const PID_LIMIT = "512";

/**
 * What an application needs installed, when its own package.json does not say.
 *
 * A monorepo application often declares nothing and resolves everything from
 * the workspace root. The root is precisely what must not enter the image, so
 * the driver states the dependency surface instead. It is per-application and
 * explicit for the same reason the build command is: guessing here would mean
 * installing whatever a stranger's manifest asked for.
 */
export type ContainerSpec = {
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts: { build: string; start: string };
};

const SPECS: Record<string, ContainerSpec> = {
  "apps/shopstack": {
    dependencies: {
      next: "^15.5.24",
      react: "^19.1.4",
      "react-dom": "^19.1.4",
    },
    devDependencies: {
      "@tailwindcss/postcss": "^4.1.13",
      tailwindcss: "^4.1.13",
      typescript: "^5",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
    },
    scripts: { build: "next build", start: "next start -p 4000 -H 0.0.0.0" },
  },
};

function docker(args: string[], timeoutMs = DOCKER_TIMEOUT_MS): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { env: childEnv() });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const kill = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(kill);
      resolve({ ok: code === 0, output: output.slice(-6000) });
    });
    child.on("error", (err) => {
      clearTimeout(kill);
      resolve({ ok: false, output: String(err) });
    });
  });
}

/** Derived from the directory so a project always addresses its own container. */
function names(app: AppUnderTest) {
  const slug = app.dir.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return {
    image: `parikshan-aut/${slug}:latest`,
    container: `parikshan-aut-${slug}`,
    proxy: `parikshan-aut-${slug}-proxy`,
    internal: "parikshan-aut-internal",
    edge: "parikshan-aut-edge",
  };
}

/**
 * Assembles the build context in a temporary directory.
 *
 * Copying rather than mounting is the whole point: the container is built from
 * a snapshot of the application, and the host directory it came from is not
 * reachable from inside. node_modules and any previous build output are left
 * behind - they belong to the host's toolchain and would mask what the image
 * actually installs.
 */
async function buildContext(app: AppUnderTest, repoRoot: string, spec: ContainerSpec): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "parikshan-ctx-"));
  const source = path.join(repoRoot, app.dir);

  await cp(source, dir, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== "node_modules" && base !== ".next" && base !== ".git";
    },
  });

  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "app-under-test",
        private: true,
        version: "0.0.0",
        scripts: spec.scripts,
        dependencies: spec.dependencies,
        devDependencies: spec.devDependencies ?? {},
      },
      null,
      2,
    ),
    "utf8",
  );

  return dir;
}

/**
 * Two networks, because one cannot do both jobs.
 *
 * Docker refuses to publish a port from a container on an `--internal`
 * network - the flag is accepted and silently ignored, and the container comes
 * up serving nothing the host can reach. But `--internal` is the only thing
 * that actually severs egress: a bridge with ip-masquerade disabled still
 * reaches the internet on Docker Desktop, because the NAT happens in the
 * virtual machine's gateway rather than in the bridge driver. Both were tried;
 * both failed, in opposite directions.
 *
 * So the application sits alone on the internal network with no route off the
 * machine, and a socat container attached to both networks forwards the port.
 * The proxy has egress and the application does not, which is the right way
 * round: the proxy runs an image this repository chose, and the application
 * runs whatever a stranger's package.json asked for.
 */
async function ensureNetworks(internal: string, edge: string): Promise<void> {
  if (!(await docker(["network", "inspect", internal])).ok) {
    await docker(["network", "create", "--internal", internal]);
  }
  if (!(await docker(["network", "inspect", edge])).ok) {
    await docker(["network", "create", edge]);
  }
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export const containerProcess: AppDriver = {
  name: "container",

  async rebuildAndRestart(app, repoRoot): Promise<RebuildResult> {
    const spec = SPECS[app.dir];
    if (!spec) {
      return {
        ok: false,
        stage: "build",
        output:
          `No container spec for "${app.dir}". An application has to declare what it installs and how it builds; ` +
          `this driver will not infer either from a manifest it did not write.`,
      };
    }

    const { image, container, proxy, internal, edge } = names(app);
    let context: string | null = null;

    try {
      context = await buildContext(app, repoRoot, spec);

      // The build runs inside the image, so a failure here is a build failure
      // in exactly the sense the harness means it.
      const built = await docker(
        ["build", "--file", path.join(repoRoot, "docker/app-under-test.Dockerfile"), "--tag", image, context],
        BUILD_TIMEOUT_MS,
      );
      if (!built.ok) return { ok: false, stage: "build", output: built.output };

      await this.stop(app);
      await ensureNetworks(internal, edge);

      // The application: internal network only, so it has no route off the
      // machine and no published port of its own.
      const started = await docker([
        "run",
        "--detach",
        "--name", container,
        "--network", internal,
        "--cpus", CPU_LIMIT,
        "--memory", MEMORY_LIMIT,
        "--pids-limit", PID_LIMIT,
        // Nothing inside needs to write outside its own tree, and a read-only
        // root turns "the build wrote somewhere odd" into a visible error.
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
        "--tmpfs", "/workspace/.next/cache:rw,size=256m",
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        "--restart", "no",
        image,
      ]);
      if (!started.ok) return { ok: false, stage: "start", output: started.output };

      // The proxy: on both networks, carrying the port to the host. socat is
      // an image this repository chose, not one the application supplied.
      const forwarded = await docker([
        "run",
        "--detach",
        "--name", proxy,
        "--network", edge,
        "--publish", `${app.port}:4000`,
        "--security-opt", "no-new-privileges",
        "--restart", "no",
        "alpine/socat",
        "tcp-listen:4000,fork,reuseaddr",
        `tcp-connect:${container}:4000`,
      ]);
      if (!forwarded.ok) return { ok: false, stage: "start", output: forwarded.output };

      const attached = await docker(["network", "connect", internal, proxy]);
      if (!attached.ok) return { ok: false, stage: "start", output: attached.output };
      // socat resolves its target once, at start, so it has to be restarted
      // after gaining the network on which that name resolves.
      await docker(["restart", proxy]);

      const up = await waitUntil(() => isUp(app.baseUrl), READY_TIMEOUT_MS);
      if (!up) {
        const logs = await docker(["logs", "--tail", "80", container]);
        return {
          ok: false,
          stage: "start",
          output: `The container started but did not answer on ${app.baseUrl}.\n\n${logs.output}`,
        };
      }

      return { ok: true, stage: "done", output: built.output.slice(-500) };
    } finally {
      // The context is a snapshot, not state. Leaving copies of applications
      // in the temp directory would be its own quiet disclosure.
      if (context) await rm(context, { recursive: true, force: true }).catch(() => {});
    }
  },

  async ensureRunning(app, repoRoot) {
    if (await isUp(app.baseUrl)) return true;

    const { container, proxy } = names(app);
    const restarted = await docker(["start", container]);
    await docker(["start", proxy]);
    if (restarted.ok && (await waitUntil(() => isUp(app.baseUrl), READY_TIMEOUT_MS))) return true;

    // No container to restart, or it will not come up: build it again rather
    // than reporting a failure the caller cannot act on.
    const result = await this.rebuildAndRestart(app, repoRoot);
    return result.ok;
  },

  async stop(app) {
    // Both, and the proxy first: a forwarder pointing at a container that has
    // gone is a connection that hangs rather than one that fails.
    const { container, proxy } = names(app);
    await docker(["rm", "--force", proxy]);
    await docker(["rm", "--force", container]);
  },
};
