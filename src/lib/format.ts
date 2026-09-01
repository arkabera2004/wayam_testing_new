/** "2m ago" style timestamps, so tables read the way the demo data did. */
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return "never";
  const then = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`;
}

/** Maps the database's run/result vocabulary onto the UI's StatusBadge tones. */
export function toUiStatus(status: string | null | undefined) {
  switch (status) {
    case "passed":
    case "pass":
      return "passed" as const;
    case "failed":
    case "fail":
    case "error":
      return "failed" as const;
    case "partial":
      return "flaky" as const;
    case "running":
      return "running" as const;
    default:
      return "queued" as const;
  }
}
