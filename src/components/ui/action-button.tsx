"use client";

import type { ComponentProps } from "react";

import { Button } from "./index";
import { useToast } from "./toast";
import type { IconName } from "@/lib/icons";
import { icons } from "@/lib/icons";

/**
 * A button for an action this build cannot really perform yet.
 *
 * Parikshan has no backend, so controls like "Export" or "Re-run" had no
 * handler at all — clicking them did nothing, which reads as a broken app
 * rather than an unfinished one. Eight screens already answered that problem
 * with a toast, so this wraps the same pattern in one place and keeps the
 * server components that use it from having to go client-side wholesale.
 *
 * When a real endpoint arrives, replace the usage with a normal Button and an
 * onClick; nothing else has to change.
 */
type ActionButtonProps = Omit<ComponentProps<typeof Button>, "icon" | "onClick"> & {
  icon?: IconName;
  /** Toast headline, e.g. "Export queued". */
  title: string;
  body?: string;
  tone?: "success" | "info" | "warning" | "error";
};

export function ActionButton({
  icon,
  title,
  body,
  tone = "info",
  children,
  ...props
}: ActionButtonProps) {
  const { toast } = useToast();

  return (
    <Button
      {...props}
      icon={icon ? icons[icon] : undefined}
      onClick={() => toast({ tone, title, body })}
    >
      {children}
    </Button>
  );
}
