import Link from "next/link";

import { PageBody } from "@/components/layout/app-shell";
import { Card, Chip, PageHeader, StatusBadge, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { AppIcon } from "@/components/ui/app-icon";
import { notFound } from "next/navigation";

import { rankedTests, resolveProject, type RankedTestView } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { toUiStatus } from "@/lib/format";
import type { IconName } from "@/lib/icons";

/**
 * Ported from AIDLC-Azure's Risk-Based Test Prioritization. The bucket
 * thresholds are the original's: high >= 80, medium 40-79, low below that.
 */
const BUCKETS: { label: string; icon: IconName; tone: string; edge: string; match: (t: RankedTestView) => boolean }[] = [
  { label: "High priority", icon: "warning", tone: "text-error", edge: "border-l-error-icon", match: (t) => t.priority >= 80 },
  { label: "Medium priority", icon: "info", tone: "text-warning", edge: "border-l-warning-icon", match: (t) => t.priority >= 40 && t.priority < 80 },
  { label: "Low priority", icon: "check", tone: "text-success", edge: "border-l-success-icon", match: (t) => t.priority < 40 },
];

function Row({ t, id, edge }: { t: RankedTestView; id: string; edge: string }) {
  return (
    <li className={cn("border-muted hover:bg-raised border-l-2 transition-colors duration-[170ms]", edge)}>
      <Link href={`/projects/${id}/tests/${t.id}`} className="flex items-start gap-3 px-4 py-3">
        <span className="font-display text-display-xs text-primary tabular w-10 shrink-0 pt-0.5">{t.priority}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-md text-primary">{t.name}</span>
            <Chip>{t.journey}</Chip>
            {t.knownFailure && <Chip tone="error">known failure</Chip>}
          </div>
          <p className="text-body-sm text-tertiary mt-1">{t.reason}</p>
        </div>
        {t.status ? <StatusBadge status={toUiStatus(t.status)} /> : null}
      </Link>
    </li>
  );
}

export default async function PrioritizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();

  const project = await resolveProject(userId, id);
  if (!project) notFound();

  const ranked = await rankedTests(userId, project.id);
  const known = ranked.filter((t) => t.knownFailure);

  return (
    <PageBody>
      <PageHeader
        title="Risk Ranking"
        description="Execution order derived from failure history, risk exposure and severity. Work the top of the list first."
        actions={
          <ActionButton icon="refresh" title="Re-ranking" body="Re-evaluating with the latest execution data.">
            Refresh ranking
          </ActionButton>
        }
      />

      {known.length > 0 && (
        <Card
          title="Known failures pending resolution"
          subtitle="Already failing or quarantined - these rank highest regardless of score"
          padded={false}
        >
          <ul className="divide-muted flex flex-col divide-y">
            {known.map((t) => (
              <Row key={t.id} t={t} id={id} edge="border-l-error-icon" />
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5 flex flex-col gap-5">
        {BUCKETS.map((b) => {
          const items = ranked.filter(b.match);
          if (!items.length) return null;
          return (
            <Card key={b.label} padded={false}>
              <div className="border-muted flex items-center gap-2 border-b px-4 py-3">
                <AppIcon name={b.icon} size="sm" className={b.tone} />
                <span className="text-heading-sm text-primary">{b.label}</span>
                <Chip tone="neutral">{items.length}</Chip>
              </div>
              <ul className="divide-muted flex flex-col divide-y">
                {items.map((t) => (
                  <Row key={t.id} t={t} id={id} edge={b.edge} />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </PageBody>
  );
}
