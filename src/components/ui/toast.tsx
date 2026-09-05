"use client";

import { AppIcon } from "@/components/ui/app-icon";
import type { IconName } from "@/lib/icons";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "./index";

type ToastTone = "success" | "info" | "warning" | "error";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; href: string };
};

type ToastContextValue = {
  toast: (t: Omit<Toast, "id">) => void;
};

/** Inert default for the same partial-RSC-render reason as the theme context. */
const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const TONES: Record<ToastTone, { icon: IconName; chip: string; border: string }> = {
  success: { icon: "check", chip: "bg-success-surface text-success", border: "border-success-stroke/50" },
  info: { icon: "info", chip: "bg-info-surface text-info", border: "border-info-stroke/50" },
  warning: { icon: "warning", chip: "bg-warning-surface text-warning", border: "border-warning-stroke/50" },
  error: { icon: "warning", chip: "bg-error-surface text-error", border: "border-error-stroke/50" },
};

const AUTODISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismiss(id), AUTODISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        /* Anchored bottom-right: every screen puts its primary actions in the
           top-right header, and each toast is pointer-events-auto so it can
           carry a dismiss button - sitting up there meant a toast swallowed
           clicks on the very button that raised it. Column-reverse keeps the
           newest nearest the corner. */
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col-reverse gap-2"
      >
        {toasts.map((t) => {
          const meta = TONES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "bg-container pointer-events-auto flex gap-3 rounded-xl border p-3.5",
                "node-pop",
                meta.border,
              )}
            >
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", meta.chip)}>
                <AppIcon name={meta.icon} size="sm" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-label-md text-primary">{t.title}</p>
                {t.body ? <p className="text-body-sm text-tertiary mt-0.5">{t.body}</p> : null}
                {t.action ? (
                  <a
                    href={t.action.href}
                    className="text-label-sm text-info mt-2 inline-block hover:underline underline-offset-4"
                  >
                    {t.action.label}
                  </a>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="icon-quaternary hover:icon-secondary grid h-5 w-5 shrink-0 place-items-center rounded"
              >
                <AppIcon name="close" size="xs" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
