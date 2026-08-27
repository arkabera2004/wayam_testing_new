import type { RunResultDoc } from "@/integrations/mongodb/schema";

export interface TrendPoint {
  day: string;
  passed: number;
  failed: number;
}

const TREND_DAYS = 7;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function dayLabel(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(2000, (month ?? 1) - 1, day ?? 1)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Last-7-days UTC-bucketed pass/fail counts. Shared by the analytics page
 * and the dashboard so both report the exact same trend line. */
export function computeWeeklyTrend(
  results: Array<Pick<RunResultDoc, "status" | "createdAt">>,
): TrendPoint[] {
  const trendMap = new Map<string, { passed: number; failed: number }>();
  const today = new Date();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    trendMap.set(dayKey(d), { passed: 0, failed: 0 });
  }
  for (const result of results) {
    const key = dayKey(result.createdAt);
    const bucket = trendMap.get(key);
    if (!bucket) continue; // outside the 7-day window
    if (result.status === "passed") bucket.passed += 1;
    else if (result.status === "failed") bucket.failed += 1;
  }
  return Array.from(trendMap.entries()).map(([key, counts]) => ({ day: dayLabel(key), ...counts }));
}
