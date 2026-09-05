import "server-only";

import { spawn } from "node:child_process";
import { copyFile, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { classifyRun, type HistoryEntry, type ResultInput, type Verdict } from "./failure-classifier";
import { correlate } from "./cross-layer";

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

  // A project records where its application runs; a spec has to be pointed at
  // it rather than at whatever the process serving this happens to be.
  const [project] = await db
    .select({ baseUrl: schema.projects.baseUrl })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

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

  const writtenResults: ResultInput[] = [];

  const dir = path.join(process.cwd(), RUN_ROOT, run.id);
  const artifactDir = path.join(process.cwd(), ARTIFACT_ROOT, run.id);
  const started = Date.now();

  try {
    await mkdir(dir, { recursive: true });

    // Every spec is rewritten to import its test from a fixture written
    // alongside it. That fixture attaches network and console listeners to the
    // page, so what the app answered underneath a UI failure is recorded
    // without any spec having to ask for it. A spec that was written by hand
    // gets the same treatment as a generated one.
    await writeFile(path.join(dir, "parikshan-capture.ts"), CAPTURE_FIXTURE, "utf8");
    await Promise.all(
      runnable.map((c) =>
        writeFile(
          path.join(dir, c.id + ".spec.ts"),
          instrumentSpec(c.playwrightCode as string),
          "utf8",
        ),
      ),
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
            BASE_URL: opts?.baseUrl ?? project?.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000",
          },
        },
      );
      const kill = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS);
      // A non-zero exit only means some tests failed, which is a normal
      // outcome here - the report is the source of truth, not the exit code.
      child.on("close", () => { clearTimeout(kill); resolve(); });
      child.on("error", () => { clearTimeout(kill); resolve(); });
    });

    // What each spec saw underneath the UI, written by the fixture.
    const captures = new Map<string, CapturedLayers>();
    await Promise.all(
      runnable.map(async (c) => {
        try {
          const raw = await readFile(path.join(dir, `${c.id}.capture.json`), "utf8");
          captures.set(c.id, JSON.parse(raw) as CapturedLayers);
        } catch {
          /* A spec that never navigated leaves no capture; that is not an error. */
        }
      }),
    );

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

      const [written] = await db
        .insert(schema.testRunResults)
        .values({
          runId: run.id,
          testCaseId: c.id,
          status: ok ? "pass" : spec ? "fail" : "error",
          durationMs: result?.duration ?? 0,
          errorMessage: result?.error?.message ? stripAnsi(result.error.message).slice(0, 2000) : null,
          screenshotUrl,
          networkEvents: captures.get(c.id)?.network ?? null,
          logs: captures.get(c.id)?.console?.length
            ? captures.get(c.id)!.console.join("\n").slice(0, 4000)
            : null,
        })
        .returning();
      writtenResults.push({
        id: written.id,
        testCaseId: written.testCaseId,
        status: written.status,
        errorMessage: written.errorMessage,
        durationMs: written.durationMs,
      });
    }

    // Classified after the loop, because two of the signals cannot be seen from
    // a single result: what the rest of this run did, and what this same spec
    // did in earlier runs.
    await classifyAndStore(db, run.id, runnable.map((c) => c.id), writtenResults);

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

/**
 * Classifies this run's failures and stores the verdict on each result.
 *
 * Reads the previous outcomes of the same specs so a flake can be told from a
 * clean break, and reads when each spec was last edited so a change of outcome
 * that follows an edit is not mistaken for non-determinism.
 */
async function classifyAndStore(
  db: ReturnType<typeof getDb>,
  runId: string,
  caseIds: string[],
  results: ResultInput[],
) {
  if (results.length === 0) return;

  const prior = await db
    .select({
      testCaseId: schema.testRunResults.testCaseId,
      status: schema.testRunResults.status,
      at: schema.testRuns.startedAt,
      classification: schema.testRunResults.classification,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testRuns, eq(schema.testRunResults.runId, schema.testRuns.id))
    .where(and(inArray(schema.testRunResults.testCaseId, caseIds), ne(schema.testRunResults.runId, runId)))
    .orderBy(desc(schema.testRuns.startedAt));

  const history = new Map<string, HistoryEntry[]>();
  for (const row of prior) {
    if (!row.testCaseId) continue;
    const list = history.get(row.testCaseId) ?? [];
    list.push({ status: row.status, at: row.at, classification: row.classification });
    history.set(row.testCaseId, list);
  }

  const cases = await db
    .select({ id: schema.testCases.id, updatedAt: schema.testCases.updatedAt })
    .from(schema.testCases)
    .where(inArray(schema.testCases.id, caseIds));
  const caseUpdatedAt = new Map(cases.map((c) => [c.id, c.updatedAt]));

  const verdicts = classifyRun({ results, history, caseUpdatedAt });

  // The UI verdict is only the first layer. What the page actually received
  // underneath it can confirm, weaken or overturn it.
  const layers = await db
    .select({
      id: schema.testRunResults.id,
      networkEvents: schema.testRunResults.networkEvents,
      logs: schema.testRunResults.logs,
    })
    .from(schema.testRunResults)
    .where(inArray(schema.testRunResults.id, [...verdicts.keys()]));

  const correlated = new Map<string, Verdict>();
  for (const [id, verdict] of verdicts) {
    const layer = layers.find((l) => l.id === id);
    correlated.set(id, correlate(verdict, layer?.networkEvents ?? null, layer?.logs ?? null));
  }
  await store(db, correlated);

  // A verdict is a reading of the evidence available when it was written, and
  // a flake only shows itself once it recovers: at the third failure in a row
  // the honest reading is "this broke and stayed broken". Once a later run
  // passes, that same failure looks different. So the recent failures of these
  // specs are judged again with what is now known, rather than being left
  // wrong for good.
  await reclassifyRecent(db, caseIds, caseUpdatedAt);
}

async function store(db: ReturnType<typeof getDb>, verdicts: Map<string, Verdict>) {
  for (const [resultId, verdict] of verdicts) {
    await db
      .update(schema.testRunResults)
      .set({
        classification: verdict.classification,
        classificationConfidence: verdict.confidence,
        classificationEvidence: verdict.evidence,
      })
      .where(eq(schema.testRunResults.id, resultId));
  }
}

/** How many recent runs are revisited when new outcomes arrive. */
const RECLASSIFY_RUNS = 6;

async function reclassifyRecent(
  db: ReturnType<typeof getDb>,
  caseIds: string[],
  caseUpdatedAt: Map<string, Date | null>,
) {
  const rows = await db
    .select({
      id: schema.testRunResults.id,
      runId: schema.testRunResults.runId,
      testCaseId: schema.testRunResults.testCaseId,
      status: schema.testRunResults.status,
      errorMessage: schema.testRunResults.errorMessage,
      durationMs: schema.testRunResults.durationMs,
      classification: schema.testRunResults.classification,
      networkEvents: schema.testRunResults.networkEvents,
      logs: schema.testRunResults.logs,
      at: schema.testRuns.startedAt,
    })
    .from(schema.testRunResults)
    .innerJoin(schema.testRuns, eq(schema.testRunResults.runId, schema.testRuns.id))
    .where(inArray(schema.testRunResults.testCaseId, caseIds))
    .orderBy(desc(schema.testRuns.startedAt));

  const runsNewestFirst = [...new Set(rows.map((r) => r.runId))].slice(0, RECLASSIFY_RUNS);

  for (const runId of runsNewestFirst) {
    const inRun = rows.filter((r) => r.runId === runId);
    if (!inRun.some((r) => r.status !== "pass")) continue;

    // History for this run means every other run, including later ones - that
    // hindsight is the whole point of looking again.
    const history = new Map<string, HistoryEntry[]>();
    for (const row of rows) {
      if (row.runId === runId || !row.testCaseId) continue;
      const list = history.get(row.testCaseId) ?? [];
      list.push({ status: row.status, at: row.at, classification: row.classification });
      history.set(row.testCaseId, list);
    }

    const fresh = classifyRun({
      results: inRun.map((r) => ({
        id: r.id,
        testCaseId: r.testCaseId,
        status: r.status,
        errorMessage: r.errorMessage,
        durationMs: r.durationMs,
      })),
      history,
      caseUpdatedAt,
    });

    const withLayers = new Map<string, Verdict>();
    for (const [id, verdict] of fresh) {
      const row = inRun.find((r) => r.id === id);
      withLayers.set(id, correlate(verdict, row?.networkEvents ?? null, row?.logs ?? null));
    }
    await store(db, withLayers);
  }
}

export type NetworkEvent = {
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  /** Only kept for responses that failed, which is what a failure needs. */
  body: string | null;
  failure: string | null;
  ms: number;
};

export type CapturedLayers = { network: NetworkEvent[]; console: string[] };

/**
 * Points a spec's imports at the capture fixture.
 *
 * Rewriting the import rather than asking spec authors to change anything is
 * what makes this work for hand-written specs as well as generated ones. The
 * fixture re-exports expect unchanged, so only where `test` comes from moves.
 */
function instrumentSpec(code: string): string {
  return code.replace(
    /from\s+["']@playwright\/test["']/g,
    'from "./parikshan-capture"',
  );
}

/**
 * Written next to the specs at run time. It records what the page asked for and
 * what came back, plus browser console errors, then writes them beside the spec
 * for the runner to read. Response bodies are only kept for failures - a
 * successful body is rarely why a test failed and would dwarf everything else.
 */
const CAPTURE_FIXTURE = `import { test as base, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";

const MAX_BODY = 1500;
const MAX_EVENTS = 60;

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const network = [];
    const consoleLines = [];
    const startedAt = Date.now();

    page.on("response", async (res) => {
      if (network.length >= MAX_EVENTS) return;
      const req = res.request();
      // Documents and API calls are what matter; asset noise is not.
      const type = req.resourceType();
      if (type !== "document" && type !== "fetch" && type !== "xhr") return;
      const ok = res.status() < 400;
      let body = null;
      if (!ok) {
        try {
          body = (await res.text()).slice(0, MAX_BODY);
        } catch {
          body = null;
        }
      }
      network.push({
        method: req.method(),
        url: res.url(),
        status: res.status(),
        ok,
        body,
        failure: null,
        ms: Date.now() - startedAt,
      });
    });

    page.on("requestfailed", (req) => {
      if (network.length >= MAX_EVENTS) return;
      const type = req.resourceType();
      if (type !== "document" && type !== "fetch" && type !== "xhr") return;
      network.push({
        method: req.method(),
        url: req.url(),
        status: null,
        ok: false,
        body: null,
        failure: req.failure()?.errorText ?? "request failed",
        ms: Date.now() - startedAt,
      });
    });

    page.on("console", (msg) => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      if (consoleLines.length >= 40) return;
      consoleLines.push(msg.type().toUpperCase() + ": " + msg.text().slice(0, 300));
    });

    page.on("pageerror", (err) => {
      if (consoleLines.length >= 40) return;
      consoleLines.push("PAGEERROR: " + String(err).slice(0, 300));
    });

    await use(page);

    // Named from the spec file, which the runner names after the test case.
    const caseId = path.basename(testInfo.file).replace(/\\.spec\\.ts$/, "");
    try {
      writeFileSync(
        path.join(path.dirname(testInfo.file), caseId + ".capture.json"),
        JSON.stringify({ network, console: consoleLines }),
      );
    } catch {
      /* Losing a capture must never fail the test it was watching. */
    }
  },
});

export { expect };
`;
