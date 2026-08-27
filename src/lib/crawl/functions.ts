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
