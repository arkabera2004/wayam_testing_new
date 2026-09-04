import "server-only";

/**
 * Progress for a running import, so the UI can show how far along it is
 * instead of a spinner that says nothing.
 *
 * Held in memory. An import lasts seconds and belongs to the request that
 * started it, so there is nothing worth persisting - but it does mean progress
 * is lost on restart and is not shared between instances. The client treats a
 * missing record as "not running" rather than as an error.
 */

export type ImportPhase = "listing" | "reading" | "analysing" | "saving" | "done" | "failed";

export type ImportProgress = {
  phase: ImportPhase;
  /** Files whose contents have been read, against how many will be. */
  done: number;
  total: number;
  percent: number;
  message: string;
  error?: string;
  updatedAt: number;
};

const progress = new Map<string, ImportProgress>();

/** Phases carry a floor so the bar never appears to go backwards. */
const FLOOR: Record<ImportPhase, number> = {
  listing: 5,
  reading: 10,
  analysing: 85,
  saving: 92,
  done: 100,
  failed: 100,
};

export function setProgress(
  projectId: string,
  phase: ImportPhase,
  message: string,
  counts?: { done: number; total: number },
) {
  const floor = FLOOR[phase];
  // Reading is the long part, so it owns the span between its floor and the
  // next phase and reports real file counts inside it.
  const percent =
    phase === "reading" && counts && counts.total > 0
      ? Math.min(84, floor + Math.round((counts.done / counts.total) * (85 - floor)))
      : floor;

  progress.set(projectId, {
    phase,
    done: counts?.done ?? 0,
    total: counts?.total ?? 0,
    percent,
    message,
    updatedAt: Date.now(),
  });
}

export function failProgress(projectId: string, error: string) {
  progress.set(projectId, {
    phase: "failed",
    done: 0,
    total: 0,
    percent: 100,
    message: "Import failed",
    error,
    updatedAt: Date.now(),
  });
}

export function getProgress(projectId: string): ImportProgress | null {
  const row = progress.get(projectId);
  if (!row) return null;
  // A finished record is kept briefly so a poll that arrives just after the
  // request returns still sees the completed state, then cleared.
  if (row.phase === "done" || row.phase === "failed") {
    if (Date.now() - row.updatedAt > 30_000) {
      progress.delete(projectId);
      return null;
    }
  }
  return row;
}

export function clearProgress(projectId: string) {
  progress.delete(projectId);
}
