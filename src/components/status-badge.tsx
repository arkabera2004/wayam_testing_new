import { CheckCircle2, XCircle, AlertTriangle, Loader2, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

export type Status =
  | "passed"
  | "passing"
  | "failed"
  | "failing"
  | "flaky"
  | "running"
  | "not_run"
  | "proposed"
  | "accepted"
  | "rejected"
  | "skipped";

const STATUS_CONFIG: Record<
  Status,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  passed: { label: "Passed", className: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
  passing: { label: "Passing", className: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
  accepted: { label: "Accepted", className: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
  failing: { label: "Failing", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
  flaky: { label: "Flaky", className: "bg-warning/15 text-warning border-warning/30", Icon: AlertTriangle },
  running: { label: "Running", className: "bg-primary/15 text-primary border-primary/30", Icon: Loader2 },
  not_run: { label: "Not run", className: "bg-muted text-muted-foreground border-border", Icon: Circle },
  proposed: { label: "Proposed", className: "bg-muted text-muted-foreground border-border", Icon: Circle },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground border-border", Icon: Circle },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = STATUS_CONFIG[status];
  const { label, className: statusClassName, Icon } = config;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        statusClassName,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {label}
    </span>
  );
}

const PRIORITY_CONFIG: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG["medium"],
        className,
      )}
    >
      {priority}
    </span>
  );
}
