"use client";

import { AppIcon } from "@/components/ui/app-icon";

import { useState } from "react";

import { Button, Chip, cn } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";

import type { IconName } from "@/lib/icons";
function Field({
  id,
  label,
  type = "text",
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md text-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={cn(
          "border-muted bg-raised text-body-md text-primary placeholder:text-quaternary",
          "h-9 rounded-lg border px-3",
          "focus-visible:border-active focus-visible:outline-none",
        )}
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
}: {
  id: string;
  label: string;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md text-secondary">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "border-muted bg-raised text-body-md text-primary",
          "h-9 rounded-lg border px-2.5",
          "focus-visible:border-active focus-visible:outline-none",
        )}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * The wedge screen. Two mutually exclusive sources, plus the credentials
 * accordion that answers the "but my app needs login" objection.
 */
export function ProjectSourcePicker({
  showAdvanced = false,
  repoUrl = "",
  onRepoUrlChange,
}: {
  showAdvanced?: boolean;
  repoUrl?: string;
  onRepoUrlChange?: (url: string) => void;
}) {
  const [source, setSource] = useState<"url" | "repo">("url");
  const [authOpen, setAuthOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              key: "repo" as const,
              icon: "github" as IconName,
              title: "Import a public repository",
              body: "We read its routes and components to plan deeper tests. No authorisation needed.",
            },
            {
              key: "url" as const,
              icon: "globe" as IconName,
              title: "Paste a live URL",
              body: "Fastest path. No repository access required.",
            },
          ]
        ).map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setSource(card.key)}
            aria-pressed={source === card.key}
            className={cn(
              "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left",
              "transition-[background-color,border-color] duration-[170ms]",
              source === card.key
                ? "border-active bg-raised"
                : "border-muted bg-container hover:bg-raised",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full",
                source === card.key ? "bg-action-primary icon-on-color" : "bg-raised-2 icon-tertiary",
              )}
            >
              <AppIcon name={card.icon} size="sm" />
            </span>
            <span className="text-heading-sm text-primary">{card.title}</span>
            <span className="text-body-md text-tertiary">{card.body}</span>
          </button>
        ))}
      </div>

      {source === "repo" ? (
        <div className="border-muted bg-container flex flex-col gap-2 rounded-xl border p-4">
          {/* No authorisation step: a public repository is read anonymously,
              so the URL is the only thing needed. This used to offer an
              "Authorise GitHub" button that could not authorise anything and a
              list of repositories that did not exist. */}
          <label htmlFor="repo-url" className="text-label-md text-secondary">
            Public repository URL
          </label>
          <input
            id="repo-url"
            value={repoUrl}
            onChange={(e) => onRepoUrlChange?.(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="border-muted bg-raised text-body-md text-primary focus-visible:border-active h-9 rounded-lg border px-3 focus-visible:outline-none"
          />
          <p className="text-body-sm text-quaternary">
            Parikshan reads the file tree and derives the routes and API endpoints it finds. The
            default branch is used. Private repositories cannot be read this way.
          </p>
        </div>
      ) : (
        <div className="border-muted bg-container flex flex-col gap-4 rounded-xl border p-4">
          <Field
            id="target-url"
            label="Application URL"
            type="url"
            defaultValue="https://shopstack.demo"
          />

          {/* AuthAccordion */}
          <div className="border-muted rounded-lg border">
            <button
              type="button"
              onClick={() => setAuthOpen((o) => !o)}
              aria-expanded={authOpen}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
            >
              <AppIcon name="lock" size="sm" className="icon-tertiary shrink-0" aria-hidden="true" />
              <span className="text-label-md text-primary flex-1">Does this app need login?</span>
              <AppIcon name="chevronDown"
                size="sm"
                aria-hidden="true"
                className={cn("icon-quaternary transition-transform duration-[170ms]", authOpen && "rotate-180")}
              />
            </button>

            {authOpen && (
              <div className="border-muted flex flex-col gap-4 border-t p-3">
                <p className="text-body-sm text-tertiary">
                  Credentials are encrypted at rest and only replayed against the target you
                  specify. Authenticated pages are crawled and tested like any other.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="auth-user" label="Username" defaultValue="demo@shopstack.demo" />
                  <Field id="auth-pass" label="Password" type="password" placeholder="••••••••" />
                </div>
                <a href="#" className="text-body-sm text-secondary hover:text-primary underline underline-offset-4">
                  Record login flow instead
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdvanced && (
        <div className="border-muted bg-container rounded-xl border">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <span className="text-label-md text-primary flex-1">Advanced options</span>
            <AppIcon name="chevronDown"
              size="sm"
              aria-hidden="true"
              className={cn(
                "icon-quaternary transition-transform duration-[170ms]",
                advancedOpen && "rotate-180",
              )}
            />
          </button>

          {advancedOpen && (
            <div className="border-muted flex flex-col gap-5 border-t p-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="depth" className="text-label-md text-secondary">
                    Crawl depth
                  </label>
                  <span className="text-label-sm text-tertiary tabular">4 levels</span>
                </div>
                <input
                  id="depth"
                  type="range"
                  min={1}
                  max={8}
                  defaultValue={4}
                  className="accent-primary mt-2 w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-label-md text-secondary">Excluded URL patterns</span>
                <div className="border-muted bg-raised flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
                  <Chip>/admin/*</Chip>
                  <Chip>/api/internal/*</Chip>
                  <Chip>*.pdf</Chip>
                  <span className="text-body-sm text-quaternary px-1">Add pattern...</span>
                </div>
              </div>

              <label className="flex items-center gap-2.5">
                <input type="checkbox" defaultChecked className="accent-primary" />
                <span className="text-body-md text-secondary">Ignore subdomains</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
