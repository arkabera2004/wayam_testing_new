// Server-side client for the standalone crawl-agent service
// (services/crawl-agent) — see that service's README for the full HTTP
// contract and architecture rationale. The frontend never talks to the
// crawl-agent directly (it may not even be reachable from the browser,
// e.g. in prod it could sit on an internal network); every call is
// proxied through these two createServerFns instead.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/lib/auth/auth-middleware";

function crawlAgentUrl(): string {
  return process.env["CRAWL_AGENT_URL"] || "http://localhost:8090";
}

export type CrawlStatus = "queued" | "running" | "completed" | "failed";

export interface CrawlActionNode {
  label: string;
  kind: string;
  target_description: string;
}

export interface CrawlPageNode {
  url: string;
  title: string;
  summary: string;
  actions: CrawlActionNode[];
  links_to: string[];
}

export interface CrawlGraph {
  root_url: string;
  pages: CrawlPageNode[];
  discovered_at: string;
}

export interface CrawlJobState {
  crawlId: string;
  status: CrawlStatus;
  graph: CrawlGraph | null;
  error: string | null;
}

/** Kicks off a crawl and returns immediately with the queued job id — the
 * caller polls getCrawlStatusFn to follow it to completion. Mirrors the
 * crawl-agent's own `queued -> running -> completed | failed` contract
 * exactly, so this function has nothing to translate or reshape. */
export const startCrawlFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ url: z.string().min(1) }))
  .handler(async ({ data }) => {
    const res = await fetch(`${crawlAgentUrl()}/crawls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: data.url }),
    });
    if (!res.ok) {
      throw new Error(`crawl-agent rejected the request (${res.status})`);
    }
    const body = (await res.json()) as { crawl_id: string; status: CrawlStatus };
    return { crawlId: body.crawl_id, status: body.status } satisfies Pick<
      CrawlJobState,
      "crawlId" | "status"
    >;
  });

export const getCrawlStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ crawlId: z.string().min(1) }))
  .handler(async ({ data }): Promise<CrawlJobState> => {
    const res = await fetch(`${crawlAgentUrl()}/crawls/${data.crawlId}`);
    if (!res.ok) {
      throw new Error(`crawl-agent lost track of this job (${res.status})`);
    }
    const body = (await res.json()) as {
      status: CrawlStatus;
      graph: CrawlGraph | null;
      error: string | null;
    };
    return { crawlId: data.crawlId, status: body.status, graph: body.graph, error: body.error };
  });

export interface HealResult {
  selector: string;
  confidence: "high" | "medium" | "low";
  notes: string;
}

/** Self-healing fallback (see services/crawl-agent/app/heal.py): hands a
 * single broken locator to the browser-use agent to re-locate on the
 * live app, rather than re-crawling everything. Synchronous — this is a
 * bounded single-element lookup, not a multi-page job, so there's no
 * queued/poll dance like startCrawlFn/getCrawlStatusFn need. */
export const healLocatorFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      url: z.string().min(1),
      targetDescription: z.string().min(1),
      previousSelector: z.string().nullable(),
    }),
  )
  .handler(async ({ data }): Promise<HealResult> => {
    const res = await fetch(`${crawlAgentUrl()}/heal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: data.url,
        target_description: data.targetDescription,
        previous_selector: data.previousSelector,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `crawl-agent could not heal this locator (${res.status})`);
    }
    return (await res.json()) as HealResult;
  });
