import type { ComponentProps, ReactNode } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import type { IconName } from "@/lib/icons";

import type { Status } from "@/lib/demo-data";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* StatusBadge                                                         */
/* ------------------------------------------------------------------ */

/**
 * Solid fill + white content. Status is the one thing that has to be readable
 * at a glance across a dense table, so it gets the loudest treatment in the
 * system. Tags and metadata stay on the subtle Chip tones.
 *
 * `dot` is the standalone indicator colour, used by StatusDot and RunDots
 * where there is no pill to sit inside.
 */
const STATUS_STYLES: Record<Status, { bg: string; dot: string; label: string }> = {
  passed: { bg: "bg-success-solid", dot: "bg-success-icon", label: "Passed" },
  failed: { bg: "bg-error-solid", dot: "bg-error-icon", label: "Failed" },
  flaky: { bg: "bg-warning-solid", dot: "bg-warning-icon", label: "Flaky" },
  healing: { bg: "bg-info-solid", dot: "bg-info-icon", label: "Healing" },
  queued: { bg: "bg-neutral-solid", dot: "bg-neutral-icon", label: "Queued" },
  running: { bg: "bg-info-solid", dot: "bg-info-icon animate-pulse", label: "Running" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "text-label-sm inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 whitespace-nowrap",
        "text-on-solid",
        s.bg,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full bg-on-solid/70",
          status === "running" && "animate-pulse",
        )}
      />
      {label ?? s.label}
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", STATUS_STYLES[status].dot)} />;
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  /** Semantic name from the icon registry - never a glyph component. */
  icon?: IconName;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-label-md whitespace-nowrap",
        "transition-[background-color,color,border-color] duration-[170ms] ease-out",
        "focus-visible:ring-2 focus-visible:ring-active focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5" : "h-8 px-3",
        variant === "primary" &&
          "bg-action-primary text-on-color hover:bg-action-primary-hover",
        variant === "secondary" &&
          "bg-action-secondary text-primary hover:bg-action-secondary-hover border border-muted",
        variant === "ghost" && "text-secondary hover:bg-action-tertiary-hover hover:text-primary",
        variant === "danger" && "bg-error-surface text-error border-error-stroke/40 border",
        className,
      )}
      {...props}
    >
      {icon ? <AppIcon name={icon} size="sm" /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn("border-muted bg-container rounded-xl border", className)}
    >
      {(title || actions) && (
        <header className="border-muted flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-heading-sm text-primary truncate">{title}</h2> : null}
            {subtitle ? <p className="text-body-sm text-tertiary mt-0.5">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* PageHeader                                                          */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  display = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  display?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1
          className={cn(
            "text-primary",
            display ? "font-display text-display-page" : "text-heading-lg",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-body-md text-tertiary mt-1.5 max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chip / Tag                                                          */
/* ------------------------------------------------------------------ */

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "solid";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-label-sm inline-flex items-center gap-1 rounded-md px-2 py-0.5 whitespace-nowrap",
        tone === "neutral" && "bg-raised text-secondary",
        tone === "solid" && "bg-action-primary text-on-color",
        tone === "success" && "bg-success-surface text-success",
        tone === "warning" && "bg-warning-surface text-warning",
        tone === "error" && "bg-error-surface text-error",
        tone === "info" && "bg-info-surface text-info",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card + sparkline                                               */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  className,
  tone = "neutral",
}: {
  values: number[];
  className?: string;
  tone?: "neutral" | "success" | "error";
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 24 - ((v - min) / span) * 22 - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={
          tone === "success"
            ? "var(--feedback-success-icon)"
            : tone === "error"
              ? "var(--feedback-error-icon)"
              : "var(--icon-tertiary)"
        }
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  trend,
  display = false,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "success" | "error" | "neutral";
  trend?: number[];
  display?: boolean;
}) {
  return (
    <div className="border-muted bg-container rounded-xl border p-4">
      <p className="text-label-sm text-tertiary">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p
          className={cn(
            "text-primary tabular",
            display ? "font-display text-display-sm" : "text-heading-lg",
          )}
        >
          {value}
        </p>
        {delta ? (
          <Chip tone={deltaTone === "neutral" ? "neutral" : deltaTone}>{delta}</Chip>
        ) : null}
      </div>
      {trend ? (
        <div className="mt-3">
          <Sparkline values={trend} tone={deltaTone === "error" ? "error" : "success"} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressBar                                                         */
/* ------------------------------------------------------------------ */

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "error";
  className?: string;
}) {
  return (
    <div className={cn("bg-raised h-1 w-full overflow-hidden rounded-full", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "primary" && "bg-action-primary",
          tone === "success" && "bg-success-icon",
          tone === "error" && "bg-error-icon",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Segmented pass/fail/flaky bar used on run rows. */
export function PassFailBar({
  passed,
  failed,
  flaky,
}: {
  passed: number;
  failed: number;
  flaky: number;
}) {
  const total = passed + failed + flaky || 1;
  return (
    <div className="bg-raised flex h-1.5 w-full overflow-hidden rounded-full">
      <div className="bg-success-icon h-full" style={{ width: `${(passed / total) * 100}%` }} />
      <div className="bg-warning-icon h-full" style={{ width: `${(flaky / total) * 100}%` }} />
      <div className="bg-error-icon h-full" style={{ width: `${(failed / total) * 100}%` }} />
    </div>
  );
}

/** Last-N-runs dot history. */
export function RunDots({ history }: { history: Status[] }) {
  return (
    <div className="flex items-center gap-1">
      {history.map((h, i) => (
        <StatusDot key={i} status={h} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export function Avatar({ initials, size = 24 }: { initials: string; size?: number }) {
  return (
    <span
      className="bg-raised-2 text-secondary text-label-sm inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, fontSize: size <= 24 ? 10 : 12 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function AvatarGroup({ initials }: { initials: string[] }) {
  return (
    <div className="flex -space-x-1.5">
      {initials.map((i) => (
        <span key={i} className="ring-page rounded-full ring-2">
          <Avatar initials={i} />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  art,
  title,
  description,
  action,
}: {
  icon: IconName;
  /** Optional 3D mark; replaces the flat icon when the surface has room. */
  art?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {art ?? (
        <span className="bg-raised icon-tertiary grid h-10 w-10 place-items-center rounded-full">
          <AppIcon name={icon} size="lg" />
        </span>
      )}
      <div>
        <p className="text-heading-sm text-primary">{title}</p>
        <p className="text-body-md text-tertiary mx-auto mt-1 max-w-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table primitives                                                    */
/* ------------------------------------------------------------------ */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "text-label-sm text-tertiary border-muted border-b px-4 py-2.5 font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("text-body-md text-secondary border-muted border-b px-4 py-3", className)}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Code block                                                          */
/* ------------------------------------------------------------------ */

/**
 * Token-based Playwright/YAML highlighter. Deliberately tiny - it colours
 * strings, comments, keywords and calls, which is all the demo needs, and
 * every colour comes from the feedback/text token groups.
 */
export function CodeBlock({
  code,
  language = "ts",
  showLineNumbers = true,
  className,
}: {
  code: string;
  language?: "ts" | "yaml";
  showLineNumbers?: boolean;
  className?: string;
}) {
  const lines = code.split("\n");
  return (
    <div className={cn("overflow-x-auto", className)}>
      <pre className="text-body-sm min-w-max leading-6">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers ? (
                <span className="text-quaternary tabular w-10 shrink-0 pr-4 text-right select-none">
                  {i + 1}
                </span>
              ) : null}
              <span className="whitespace-pre">{highlight(line, language)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

const TS_KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "await",
  "async",
  "expect",
  "test",
  "return",
  "new",
]);

function highlight(line: string, language: "ts" | "yaml") {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return <span className="text-quaternary">{line}</span>;
  }

  if (language === "yaml") {
    const m = line.match(/^(\s*-?\s*)([\w.-]+)(:)(.*)$/);
    if (m) {
      return (
        <>
          <span>{m[1]}</span>
          <span className="text-info">{m[2]}</span>
          <span className="text-quaternary">{m[3]}</span>
          <span className="text-secondary">{m[4]}</span>
        </>
      );
    }
    return <span className="text-secondary">{line}</span>;
  }

  // Split on single-quoted strings first, then keyword-highlight the rest.
  const parts = line.split(/('[^']*')/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("'") && part.endsWith("'") && part.length > 1) {
          return (
            <span key={i} className="text-success">
              {part}
            </span>
          );
        }
        return (
          <span key={i}>
            {part.split(/(\b\w+\b)/g).map((word, j) => {
              if (TS_KEYWORDS.has(word)) {
                return (
                  <span key={j} className="text-info">
                    {word}
                  </span>
                );
              }
              return (
                <span key={j} className="text-secondary">
                  {word}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Browser frame (used for the pull-request quality gate)              */
/* ------------------------------------------------------------------ */

export function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="border-muted bg-container overflow-hidden rounded-xl border">
      <div className="border-muted bg-raised flex items-center gap-3 border-b px-3 py-2">
        <div className="flex gap-1.5">
          <span className="bg-raised-2 h-2.5 w-2.5 rounded-full" />
          <span className="bg-raised-2 h-2.5 w-2.5 rounded-full" />
          <span className="bg-raised-2 h-2.5 w-2.5 rounded-full" />
        </div>
        <div className="bg-container text-body-sm text-tertiary flex-1 truncate rounded-md px-2.5 py-1">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}
