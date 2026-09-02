import "server-only";

import { spawn } from "node:child_process";
import { copyFile, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";

/**
 * Executes a project's specs with the real Playwright runner.
 *
 * Generated specs are written inside the repository rather than a temp
 * directory: a spec imports @playwright/test, and Node resolves that from the
 * file's own directory upwards, so a spec outside the project tree fails to
 * load before any test runs.
 *
 * One file per test case, named for its uuid, so results map back to rows by
 * file path without parsing titles.
 */
/**
 * Not a dot-directory: Playwright's file discovery skips hidden folders, so
 * specs written to ".parikshan-runs" were never collected and every case came
 * back as an error with no report entry.
 */
const RUN_ROOT = "parikshan-runs";
/** Hard ceiling so a hung page cannot block the request forever. */
const RUN_TIMEOUT_MS = 120_000;
/**
 * Screenshots outlive the run directory.
 *
 * Playwright writes them beside the generated specs, which are deleted once
 * results are recorded - so the evidence for a failure was being thrown away
 * with them. They are copied here first and served by
 * /api/runs/[runId]/artifacts/[file].
 *
 * Local disk is the right store while this runs as a long-lived server. On a
 * serverless deploy the filesystem is ephemeral and this becomes the one place
 * to swap in blob storage.
 */
const ARTIFACT_ROOT = "run-artifacts";

type Attachment = { name: string; path?: string; contentType: string };
type SpecResult = {
  duration: number;
  status: string;
  error?: { message?: string };
  attachments?: Attachment[];
};
type PlaywrightSpec = { title: string; ok: boolean; file?: string; tests: { results: SpecResult[] }[] };
type ReportSuite = { specs?: PlaywrightSpec[]; suites?: ReportSuite[] };

/** The JSON reporter nests suites arbitrarily deep; flatten to specs. */
function flattenSpecs(suite: ReportSuite): PlaywrightSpec[] {
  return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(flattenSpecs)];
}

/** Reporter errors carry colour codes; they are noise in a database column. */
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
const stripAnsi = (s: string) => s.replace(ANSI, "");

export type RunOutcome = {
  runId: string;
  status: "passed" | "failed" | "partial" | "error";
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
};

/**
 * One suite execution per project at a time. Each run spawns a Playwright
 * process and a browser, so a double-clicked button (or an impatient user on
 * two tabs) could otherwise fan out into several concurrent runs that thrash
 * the machine and race each other writing results.
 */
const inFlight = new Map<string, { key: string; promise: Promise<RunOutcome> }>();

/** Identifies "the same request", so a double-click dedupes but a different
 *  selection is not silently handed another run's results. */
function requestKey(opts?: { baseUrl?: string; caseIds?: string[] }) {
  return JSON.stringify({ baseUrl: opts?.baseUrl ?? null, caseIds: [...(opts?.caseIds ?? [])].sort() });
}

export class RunInProgressError extends Error {
  constructor() {
    super("A run is already in progress for this project. Wait for it to finish.");
    this.name = "RunInProgressError";
  }
}

export function runSuite(
  projectId: string,
  opts?: { baseUrl?: string; caseIds?: string[] },
): Promise<RunOutcome> {
  const key = requestKey(opts);
  const existing = inFlight.get(projectId);
  if (existing) {
    // Same request: return the run already underway. Different request: refuse,
    // rather than answer with results for tests the caller did not ask for.
    if (existing.key === key) return existing.promise;
    return Promise.reject(new RunInProgressError());
  }

  const promise = executeSuite(projectId, opts).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, { key, promise });
  return promise;
}

async function executeSuite(
  projectId: string,
  opts?: { baseUrl?: string; caseIds?: string[] },
): Promise<RunOutcome> {
  const db = getDb();

  const suites = await db
    .select()
    .from(schema.testSuites)
    .where(eq(schema.testSuites.projectId, projectId));
  if (suites.length === 0) throw new Error("This project has no suites to run.");

  const cases = (
    await Promise.all(
      suites.map((s) => db.select().from(schema.testCases).where(eq(schema.testCases.suiteId, s.id))),
    )
  ).flat();

  // A caller can run a subset (row menu / "Run selected"); no list means the whole suite.
  const wanted = opts?.caseIds?.length ? new Set(opts.caseIds) : null;
  const scoped = wanted ? cases.filter((c) => wanted.has(c.id)) : cases;
  if (wanted && scoped.length === 0) {
    throw new Error("None of the selected tests belong to this project.");
  }

  const runnable = scoped.filter((c) => c.playwrightCode?.trim());
  if (runnable.length === 0) {
    throw new Error(
      wanted
        ? "None of the selected tests have Playwright code yet, so there is nothing to execute."
        : "No test case has Playwright code yet, so there is nothing to execute.",
    );
  }

  const [run] = await db
    .insert(schema.testRuns)
    .values({ suiteId: suites[0].id, triggeredBy: "manual", status: "running" })
    .returning();

  const dir = path.join(process.cwd(), RUN_ROOT, run.id);
  const artifactDir = path.join(process.cwd(), ARTIFACT_ROOT, run.id);
  const started = Date.now();

  try {
    await mkdir(dir, { recursive: true });
    await Promise.all(
      runnable.map((c) => writeFile(path.join(dir, c.id + ".spec.ts"), c.playwrightCode as string, "utf8")),
    );

    const reportPath = path.join(dir, "report.json");
    await new Promise<void>((resolve) => {
      const child = spawn(
        "npx",
        [
          "playwright",
          "test",
          path.join(RUN_ROOT, run.id),
          "--reporter=json",
          "--output=" + path.join(dir, "artifacts"),
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
            // What the generated specs navigate against.
            BASE_URL: opts?.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000",
          },
        },
      );
      const kill = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS);
      // A non-zero exit only means some tests failed, which is a normal
      // outcome here - the report is the source of truth, not the exit code.
      child.on("close", () => { clearTimeout(kill); resolve(); });
      child.on("error", () => { clearTimeout(kill); resolve(); });
    });

    const report = JSON.parse(await readFile(reportPath, "utf8")) as { suites?: ReportSuite[] };
    const specs = (report.suites ?? []).flatMap(flattenSpecs);

    let passed = 0;
    let failed = 0;

    for (const c of runnable) {
      const spec = specs.find((s) => s.file?.includes(c.id));
      const result = spec?.tests?.[0]?.results?.[0];
      const ok = Boolean(spec?.ok);
      if (ok) passed++;
      else failed++;

      // Keep the screenshot before the working directory goes away.
      let screenshotUrl: string | null = null;
      const shot = result?.attachments?.find(
        (a) => a.contentType === "image/png" && a.path,
      );
      if (shot?.path) {
        try {
          await mkdir(artifactDir, { recursive: true });
          await copyFile(shot.path, path.join(artifactDir, c.id + ".png"));
          screenshotUrl = "/api/runs/" + run.id + "/artifacts/" + c.id + ".png";
        } catch {
          // A missing screenshot must not lose the result row it belongs to.
        }
      }

      await db.insert(schema.testRunResults).values({
        runId: run.id,
        testCaseId: c.id,
        status: ok ? "pass" : spec ? "fail" : "error",
        durationMs: result?.duration ?? 0,
        errorMessage: result?.error?.message ? stripAnsi(result.error.message).slice(0, 2000) : null,
        screenshotUrl,
      });
    }

    const status = failed === 0 ? "passed" : passed === 0 ? "failed" : "partial";
    await db
      .update(schema.testRuns)
      .set({ status, finishedAt: new Date() })
      .where(eq(schema.testRuns.id, run.id));

    return { runId: run.id, status, total: runnable.length, passed, failed, durationMs: Date.now() - started };
  } catch (err) {
    await db
      .update(schema.testRuns)
      .set({ status: "error", finishedAt: new Date() })
      .where(eq(schema.testRuns.id, run.id));
    throw err;
  } finally {
    // Specs are regenerated from the database each run, so nothing here is
    // worth keeping once results are recorded.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
