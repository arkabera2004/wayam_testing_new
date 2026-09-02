"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/components/ui";
import { AppIcon } from "@/components/ui/app-icon";
import { generatedTests, project, runs } from "@/lib/demo-data";

type Item = { group: string; label: string; hint?: string; href: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const base = `/projects/${project.id}`;

  const items = useMemo<Item[]>(
    () => [
      { group: "Actions", label: "Open runs", hint: "execution history", href: `${base}/runs` },
      { group: "Actions", label: "New project", href: "/projects/new" },
      { group: "Actions", label: "Export tests to repo", href: `${base}/tests` },
      { group: "Pages", label: "Application Map", href: `${base}/map` },
      { group: "Pages", label: "Test Plan", href: `${base}/plan` },
      { group: "Pages", label: "Self-Healing Center", href: `${base}/healing` },
      { group: "Pages", label: "Analytics", href: `${base}/analytics` },
      { group: "Pages", label: "Quarantine", href: `${base}/quarantine` },
      ...generatedTests.slice(0, 5).map((t) => ({
        group: "Tests",
        label: t.name,
        hint: t.journey,
        href: `${base}/tests/${t.id}`,
      })),
      ...runs.slice(0, 4).map((r) => ({
        group: "Runs",
        label: `Run #${r.id}`,
        hint: `${r.trigger} · ${r.started}`,
        href: `${base}/runs/${r.id}`,
      })),
    ],
    [base],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter" && filtered[cursor]) {
        e.preventDefault();
        router.push(filtered[cursor].href);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, cursor, onClose, router]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="bg-scrim absolute inset-0"
      />

      <div className="border-default bg-container relative z-10 w-full max-w-xl overflow-hidden rounded-xl border">
        <div className="border-muted flex items-center gap-2.5 border-b px-3.5 py-3">
          <AppIcon name="search" size="sm" className="icon-tertiary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Search tests, runs, pages..."
            aria-label="Search"
            className="text-body-md text-primary placeholder:text-quaternary w-full bg-transparent outline-none"
          />
          <kbd className="bg-raised text-caption text-tertiary rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-body-md text-tertiary px-2.5 py-6 text-center">No matches.</p>
          ) : (
            filtered.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={`${item.href}-${item.label}`}>
                  {showGroup && (
                    <p className="text-caption text-quaternary px-2.5 pt-2.5 pb-1">{item.group}</p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
                      i === cursor ? "bg-raised-2" : "hover:bg-raised",
                    )}
                  >
                    <AppIcon name="play" size="xs" className="icon-quaternary" />
                    <span className="text-body-md text-primary min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="text-caption text-quaternary shrink-0">{item.hint}</span>
                    ) : null}
                    {i === cursor ? (
                      <AppIcon name="enterKey" size="xs" className="icon-quaternary" />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
