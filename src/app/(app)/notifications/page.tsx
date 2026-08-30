"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, TriangleAlert, Wrench } from "lucide-react";

import { PageBody } from "@/components/layout/app-shell";
import { Button, Card, PageHeader, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { notifications, project, type Status } from "@/lib/demo-data";

const ICONS: Record<string, { icon: typeof Check; tone: string }> = {
  failed: { icon: AlertTriangle, tone: "bg-error-surface text-error" },
  healing: { icon: Wrench, tone: "bg-info-surface text-info" },
  flaky: { icon: TriangleAlert, tone: "bg-warning-surface text-warning" },
  passed: { icon: Check, tone: "bg-success-surface text-success" },
};

/** Deep link for each notification type, keeping the demo story navigable. */
function hrefFor(type: Status) {
  const base = `/projects/${project.id}`;
  if (type === "healing") return `${base}/healing`;
  if (type === "flaky") return `${base}/quarantine`;
  return `${base}/runs/137`;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [read, setRead] = useState(false);
  const days = Array.from(new Set(notifications.map((n) => n.day)));
  const unread = read ? 0 : notifications.filter((n) => n.unread).length;

  return (
    <PageBody>
      <PageHeader
        title="Notifications"
        description="Everything Parikshan wanted you to know, newest first."
        actions={
          <Button
            disabled={unread === 0}
            onClick={() => {
              setRead(true);
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
                  .filter((n) => n.day === day)
                  .map((n, i) => {
                    const meta = ICONS[n.type] ?? ICONS.passed;
                    return (
                      <li key={n.id} className={cn(i > 0 && "border-muted border-t")}>
                        <Link
                          href={hrefFor(n.type)}
                          className="hover:bg-raised flex items-start gap-3 px-4 py-3 transition-colors duration-[170ms]"
                        >
                          <span
                            className={cn(
                              "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                              meta.tone,
                            )}
                          >
                            <meta.icon size={13} strokeWidth={2} aria-hidden="true" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-label-md text-primary">{n.title}</p>
                            <p className="text-body-md text-tertiary mt-0.5">{n.body}</p>
                          </div>

                          <span className="text-caption text-quaternary shrink-0">{n.when}</span>
                          {n.unread && !read ? (
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
