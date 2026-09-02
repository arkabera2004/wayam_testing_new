import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatCard, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { notFound } from "next/navigation";

import { defectPrediction, resolveProject } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

type RiskLevel = "critical" | "high" | "medium" | "low";

/**
 * Ported from AIDLC-Azure's Defect Prediction: score every file on defect
 * likelihood from change frequency, bug-fix association and churn.
 *
 * The original drew a Recharts treemap. This uses a flex layout weighted by
 * churn - same encoding (area = churn, colour = risk) without adding a
 * charting dependency for one view.
 */
/**
 * `onTile` is the label colour for the risk map. The three saturated fills
 * carry white; the low tier is a neutral surface in both themes, so it needs
 * ordinary body text or the label disappears into its own tile.
 */
const RISK: Record<
  RiskLevel,
  { tone: string; surface: string; fill: string; label: string; onTile: string }
> = {
  critical: { tone: "text-error", surface: "bg-error-surface", fill: "var(--feedback-error-icon)", label: "Critical", onTile: "text-on-solid" },
  high: { tone: "text-warning", surface: "bg-warning-surface", fill: "var(--feedback-warning-icon)", label: "High", onTile: "text-on-solid" },
  medium: { tone: "text-info", surface: "bg-info-surface", fill: "var(--feedback-info-icon)", label: "Medium", onTile: "text-on-solid" },
  low: { tone: "text-tertiary", surface: "bg-raised", fill: "var(--surface-raised-x2)", label: "Low", onTile: "text-secondary" },
};

export default async function DefectPredictionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const d = await defectPrediction(userId, project.id);
  const highRisk = d.highRisk;
  const critical = d.critical;
  const totalChurn = d.files.reduce((n, f) => n + f.churn, 0);

  return (
    <PageBody>
      <PageHeader
        title="Defect Prediction"
        description="Commit history scored into file-level risk: how often a file changes, how often those changes were bug fixes, and how much churn it carries."
        actions={
          <ActionButton icon="refresh" title="Re-scoring files" body="Re-reading commit history.">
            Re-analyse
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Files analysed" value={String(d.filesAnalysed)} />
        {/* Commit totals need a scan record; churn is what the scores carry. */}
        <StatCard label="Total churn" value={String(d.files.reduce((n, f) => n + f.churn, 0))} delta="changes tracked" />
        <StatCard label="High risk" value={String(highRisk)} delta="score ≥ 50" deltaTone="error" />
        <StatCard label="Critical" value={String(critical)} delta="score ≥ 75" deltaTone="error" />
      </div>

      {/* ---- Churn / risk map ---- */}
      <Card
        className="mt-5"
        title="Risk map"
        subtitle="Width tracks churn · colour tracks risk score"
      >
        <div className="flex h-28 w-full gap-1 overflow-hidden rounded-lg">
          {d.files.map((f) => (
            <div
              key={f.filename}
              title={`${f.filename} - risk ${f.riskScore}, churn ${f.churn}`}
              style={{ flexGrow: f.churn / totalChurn, backgroundColor: RISK[f.riskLevel].fill }}
              className="relative min-w-0 rounded-md p-2"
            >
              <span className={cn("text-caption block truncate font-medium", RISK[f.riskLevel].onTile)}>
                {f.filename.split("/").pop()}
              </span>
              <span className={cn("text-caption tabular block opacity-80", RISK[f.riskLevel].onTile)}>
                {f.riskScore}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {(Object.keys(RISK) as RiskLevel[]).map((k) => (
            <span key={k} className="text-caption text-tertiary inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK[k].fill }} />
              {RISK[k].label}
            </span>
          ))}
        </div>
      </Card>

      {/* ---- File list ---- */}
      <Card className="mt-5" title="Files by risk" padded={false}>
        <ul className="divide-muted flex flex-col divide-y">
          {d.files.map((f) => (
            <li key={f.filename} className="hover:bg-raised flex items-center gap-3 px-4 py-3 transition-colors duration-[170ms]">
              <span className="font-display text-display-xs text-primary tabular w-10 shrink-0">{f.riskScore}</span>
              <div className="min-w-0 flex-1">
                <p className="text-label-md text-primary truncate font-mono">{f.filename}</p>
                <p className="text-caption text-quaternary mt-0.5">
                  {f.churn} changes · complexity {f.complexity}
                </p>
              </div>
              <div className="bg-raised-2 hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full sm:block">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${f.riskScore}%`, backgroundColor: RISK[f.riskLevel].fill }}
                />
              </div>
              <span className={cn("text-label-sm shrink-0 rounded-full px-2 py-0.5", RISK[f.riskLevel].surface, RISK[f.riskLevel].tone)}>
                {RISK[f.riskLevel].label}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </PageBody>
  );
}
