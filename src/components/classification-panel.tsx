import { Card, Chip } from "@/components/ui";

/**
 * Shows what a failure was judged to mean and, more importantly, why.
 *
 * The evidence is the point. A verdict with a percentage next to it is not
 * checkable; a list of the signals that fired, each with what it was worth, is.
 * "unclassified" is shown as plainly as any other answer, because refusing to
 * guess is a result rather than a gap.
 */
export type ClassificationEvidence = {
  signal: string;
  category: string;
  weight: number;
  detail: string;
};

const LABEL: Record<string, { text: string; tone: "error" | "warning" | "info" | "success" | undefined; blurb: string }> = {
  "real-bug": {
    text: "Real bug",
    tone: "error",
    blurb: "The application was reached and behaved wrongly.",
  },
  "test-drift": {
    text: "Test drift",
    tone: "warning",
    blurb: "The page was served but no longer matches what the test looks for.",
  },
  flaky: {
    text: "Flaky",
    tone: "warning",
    blurb: "The same unchanged spec has both passed and failed recently.",
  },
  environment: {
    text: "Environment",
    tone: "info",
    blurb: "The target could not be reached, so the application never ran.",
  },
  unclassified: {
    text: "Unclassified",
    tone: undefined,
    blurb: "The signals were too weak or too evenly split to claim an answer.",
  },
};

export function ClassificationPanel({
  classification,
  confidence,
  evidence,
}: {
  classification: string | null;
  confidence: number | null;
  evidence: ClassificationEvidence[] | null;
}) {
  if (!classification) return null;
  const label = LABEL[classification] ?? LABEL.unclassified;
  const rows = (evidence ?? []).slice().sort((a, b) => b.weight - a.weight);

  return (
    <Card
      title="What this failure means"
      subtitle={label.blurb}
      actions={
        <>
          <Chip tone={label.tone}>{label.text}</Chip>
          {classification !== "unclassified" && (
            <Chip>{confidence ?? 0}% confidence</Chip>
          )}
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="text-body-md text-tertiary">No signals were recorded for this result.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row, i) => (
            <li key={`${row.signal}-${i}`} className="flex gap-3">
              <span className="text-label-sm text-tertiary tabular w-10 shrink-0 pt-0.5 text-right">
                {row.weight > 0 ? `+${row.weight}` : "—"}
              </span>
              <span className="min-w-0">
                <span className="text-label-md text-primary block">
                  {row.signal}
                  <span className="text-quaternary"> · {row.category}</span>
                </span>
                <span className="text-body-sm text-tertiary block">{row.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
