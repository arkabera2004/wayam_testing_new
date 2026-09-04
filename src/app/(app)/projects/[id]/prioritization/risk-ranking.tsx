import Link from "next/link";

import { Card, Chip, cn } from "@/components/ui";

export type Factor = { name: string; points: number; reason: string };
export type RankedTest = { id: string; title: string; score: number; factors: Factor[]; headline: string };

/**
 * "Run these first", with the reasoning attached.
 *
 * The score is not the output; the sentences are. A ranking whose order cannot
 * be argued with is one that cannot be trusted or corrected, so every factor
 * that moved a test says what it saw and what it was worth.
 */
export function RiskRanking({ id, tests }: { id: string; tests: RankedTest[] }) {
  if (tests.length === 0) return null;
  const top = tests.slice(0, 5);

  return (
    <Card
      title="Run these first"
      subtitle="Ranked by what has actually broken here and what has recently changed"
      padded={false}
    >
      <ul className="divide-muted flex flex-col divide-y">
        {tests.map((t, i) => (
          <li key={t.id} className={cn("px-4 py-3.5", i < top.length && "bg-raised/40")}>
            <div className="flex items-start gap-3">
              <span className="font-display text-display-xs text-primary tabular w-10 shrink-0 pt-0.5">
                {t.score}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/projects/${id}/tests/${t.id}`}
                    className="text-label-md text-primary hover:underline underline-offset-4"
                  >
                    {t.title}
                  </Link>
                  {i === 0 && <Chip tone="error">Highest</Chip>}
                </div>
                <p className="text-body-sm text-tertiary mt-1">{t.headline}</p>

                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {t.factors.map((f, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span
                        className={cn(
                          "text-label-sm tabular w-8 shrink-0 text-right",
                          f.points > 0 ? "text-primary" : f.points < 0 ? "text-error" : "text-quaternary",
                        )}
                      >
                        {f.points > 0 ? `+${f.points}` : f.points < 0 ? f.points : "0"}
                      </span>
                      <span className="min-w-0">
                        <span className="text-label-sm text-secondary">{f.name}</span>
                        <span className="text-body-sm text-tertiary block">{f.reason}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
