"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { useToast } from "@/components/ui/toast";

/**
 * Runs a heal against a live page on demand.
 *
 * Healing needs a URL as well as a selector: the repair is found by looking at
 * the page as it renders now, so there is nothing to search without one.
 */
export function HealNow({ projectSlug, defaultUrl }: { projectSlug: string; defaultUrl: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState(defaultUrl);
  const [selector, setSelector] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    healed: { selector: string; strategy: string; similarity: number; reason: string } | null;
    candidates: { selector: string; similarity: number }[];
    browser: string;
  }>(null);

  async function heal() {
    if (!url.trim() || !selector.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/heal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), selector: selector.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ tone: "error", title: "Heal failed", body: data.error ?? "The page could not be opened." });
        return;
      }

      setResult(data);
      toast({
        tone: data.healed ? "success" : "warning",
        title: data.healed ? "Replacement found" : "No confident match",
        body: data.healed
          ? `${data.healed.selector} · ${data.browser} browser`
          : "Nothing on the page matched closely enough to propose.",
      });
      // A found replacement is written as a pending event.
      if (data.healed) router.refresh();
    } catch {
      toast({ tone: "error", title: "Heal failed", body: "The request did not complete." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Heal a selector"
      subtitle="Opens the page in a live browser and proposes a replacement"
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-label-sm text-tertiary">Page URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/checkout"
            className="border-muted bg-raised text-body-md text-primary h-9 rounded-lg border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-label-sm text-tertiary">Selector that no longer matches</span>
          <input
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="#pay-btn"
            className="border-muted bg-raised text-body-md text-primary h-9 rounded-lg border px-3 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active"
          />
        </label>

        <div>
          <Button variant="primary" onClick={heal} disabled={busy || !url.trim() || !selector.trim()}>
            {busy ? "Opening browser…" : "Heal this now"}
          </Button>
        </div>

        {result && (
          <div
            className={cn(
              "rounded-lg border p-3",
              result.healed ? "border-success-stroke/40 bg-success-surface" : "border-muted bg-raised",
            )}
          >
            {result.healed ? (
              <>
                <p className="text-label-md text-primary flex items-center gap-2">
                  <AppIcon name="check" size="sm" className="text-success" />
                  <span className="font-mono">{result.healed.selector}</span>
                </p>
                <p className="text-body-sm text-secondary mt-1.5">{result.healed.reason}</p>
                <p className="text-caption text-quaternary mt-1">
                  {result.healed.strategy} · {result.healed.similarity}% · {result.browser} browser
                </p>
              </>
            ) : (
              <p className="text-body-md text-secondary">
                Nothing matched closely enough. The page may have changed too much, or the selector
                may still be valid.
              </p>
            )}

            {result.candidates.length > 1 && (
              <ul className="mt-2.5 flex flex-col gap-1">
                {result.candidates.slice(1, 4).map((c) => (
                  <li key={c.selector} className="text-caption text-quaternary font-mono">
                    {c.similarity}% {c.selector}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
