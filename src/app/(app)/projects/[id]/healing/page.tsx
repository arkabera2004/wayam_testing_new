"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, Chip, PageHeader, StatCard } from "@/components/ui";
import { Icon3D } from "@/components/ui/icon-3d";
import { useToast } from "@/components/ui/toast";
import { healingEvents, healingStats } from "@/lib/demo-data";

export default function HealingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  return (
    <PageBody>
      <PageHeader
        title="Self-Healing"
        description="Every locator Parikshan repaired on its own, with the evidence behind each decision."
      />

      {/* Banner */}
      <div className="border-info-stroke/40 bg-info-surface flex items-start gap-3 rounded-xl border p-4">
        <Icon3D name="selector-repair" size={64} />
        <div>
          <p className="text-heading-sm text-primary">A locator changed</p>
          <p className="text-body-md text-secondary mt-1">
            Parikshan updated the selector automatically. Your tests stay green without the
            maintenance burden.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Healed this month" value={String(healingStats.healedThisMonth)} display />
        <StatCard label="Maintenance saved" value={`~${healingStats.hoursSaved}h`} display />
        <StatCard label="Healed today" value={String(healingStats.healedToday)} display />
      </div>

      <div className="flex flex-col gap-3">
        {healingEvents.map((event) => (
          <Card key={event.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-heading-sm text-primary">{event.test}</p>
                <p className="text-caption text-quaternary mt-1">{event.when}</p>
              </div>
              {event.status === "accepted" ? (
                <Chip tone="success">
                  <Check size={11} aria-hidden="true" />
                  Accepted
                </Chip>
              ) : (
                <Chip tone="info">Awaiting review</Chip>
              )}
            </div>

            {/* Selector diff */}
            <div className="border-muted mt-4 overflow-hidden rounded-lg border">
              <div className="bg-error-surface flex items-start gap-2.5 px-3 py-2">
                <span className="text-error text-body-sm shrink-0">&minus;</span>
                <code className="text-body-sm text-error break-all line-through">
                  {event.oldSelector}
                </code>
              </div>
              <div className="bg-success-surface flex items-start gap-2.5 px-3 py-2">
                <span className="text-success text-body-sm shrink-0">+</span>
                <code className="text-body-sm text-success break-all">{event.newSelector}</code>
              </div>
            </div>

            {/* Explainer */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="info">DOM similarity {event.similarity}%</Chip>
              <span className="text-body-sm text-tertiary">{event.reason}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {event.status === "pending" ? (
                <Button
                  variant="primary"
                  icon={Check}
                  onClick={() =>
                    toast({
                      tone: "success",
                      title: "Heal accepted",
                      body: `${event.newSelector} is now the locator of record.`,
                    })
                  }
                >
                  Accept
                </Button>
              ) : null}
              <Button
                icon={RotateCcw}
                onClick={() =>
                  toast({
                    tone: "warning",
                    title: "Heal reverted",
                    body: `Restored ${event.oldSelector}. This test will fail again until it is fixed.`,
                  })
                }
              >
                Revert
              </Button>
              <Button
                variant="ghost"
                icon={ArrowRight}
                onClick={() => router.push(`/projects/${id}/tests/tc-checkout-expired`)}
              >
                Review in code
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </PageBody>
  );
}
