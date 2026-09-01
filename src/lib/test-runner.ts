import "server-only";

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
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

type SpecResult = { duration: number; status: string; error?: { message?: string } };
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

export async function runSuite(projectId: string, opts?: { baseUrl?: string }): Promise<RunOutcome> {
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

  const runnable = cases.filter((c) => c.playwrightCode?.trim());
  if (runnable.length === 0) {
    throw new Error("No test case has Playwright code yet, so there is nothing to execute.");
  }

  const [run] = await db
    .insert(schema.testRuns)
    .values({ suiteId: suites[0].id, triggeredBy: "manual", status: "running" })
    .returning();

  const dir = path.join(process.cwd(), RUN_ROOT, run.id);
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
      // outcome here — the report is the source of truth, not the exit code.
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

      await db.insert(schema.testRunResults).values({
        runId: run.id,
        testCaseId: c.id,
        status: ok ? "pass" : spec ? "fail" : "error",
        durationMs: result?.duration ?? 0,
        errorMessage: result?.error?.message ? stripAnsi(result.error.message).slice(0, 2000) : null,
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
