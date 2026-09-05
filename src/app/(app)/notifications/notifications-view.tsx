"use client";

import type { IconName } from "@/lib/icons";
import { AppIcon } from "@/components/ui/app-icon";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, PageHeader, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { NotificationView } from "@/db/queries";
import { relativeTime } from "@/lib/format";

const ICONS: Record<string, { icon: IconName; tone: string }> = {
  failed: { icon: "warning", tone: "bg-error-surface text-error" },
  healing: { icon: "maintenance", tone: "bg-info-surface text-info" },
  flaky: { icon: "warning", tone: "bg-warning-surface text-warning" },
  passed: { icon: "check", tone: "bg-success-surface text-success" },
};

/**
 * Deep link for a notification.
 *
 * The project comes from the row rather than a fixed id, so a notification
 * links to the project it belongs to instead of always the demo one.
 */
function hrefFor(n: NotificationView) {
  const base = n.projectId ? `/projects/${n.projectId}` : "/projects";
  if (n.type === "healing") return `${base}/healing`;
  if (n.type === "quarantine" || n.type === "flaky") return `${base}/quarantine`;
  return `${base}/runs`;
}

export function NotificationsView({ notifications }: { notifications: NotificationView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter((n) => !n.readAt).length;
  const isUnread = (n: NotificationView) => !n.readAt;

  /** Groups by calendar day so the list keeps its Today / Yesterday headings. */
  const dayOf = (d: Date | null) => {
    if (!d) return "Earlier";
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    return days < 1 ? "Today" : days < 2 ? "Yesterday" : "Earlier";
  };

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/notifications", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const { toast } = useToast();
  const days = Array.from(new Set(notifications.map((n) => dayOf(n.createdAt))));

  return (
    <PageBody>
      <PageHeader
        title="Notifications"
        description="Everything Parikshan wanted you to know, newest first."
        actions={
          <Button
            disabled={unread === 0 || busy}
            onClick={() => {
              markAllRead();
              toast({ tone: "success", title: "All notifications marked read" });
            }}
          >
            {unread > 0 ? `Mark all read (${unread})` : "All read"}
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        {days.map((day) => (
          <section key={day}>
            <h2 className="text-label-sm text-tertiary mb-2">{day}</h2>
            <Card padded={false}>
              <ul>
                {notifications
                  .filter((n) => dayOf(n.createdAt) === day)
                  .map((n, i) => {
                    const meta = ICONS[n.type] ?? ICONS.passed;
                    return (
                      <li key={n.id} className={cn(i > 0 && "border-muted border-t")}>
                        <Link
                          href={hrefFor(n)}
                          className="hover:bg-raised flex items-start gap-3 px-4 py-3 transition-colors duration-[170ms]"
                        >
                          <span
                            className={cn(
                              "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                              meta.tone,
                            )}
                          >
                            <AppIcon name={meta.icon} size="sm" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-label-md text-primary">{n.title}</p>
                            <p className="text-body-md text-tertiary mt-0.5">{n.body}</p>
                          </div>

                          <span className="text-caption text-quaternary shrink-0">{relativeTime(n.createdAt)}</span>
                          {isUnread(n) ? (
                            <span className="bg-info-icon mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </PageBody>
  );
}
