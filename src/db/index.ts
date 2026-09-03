/**
 * Database client.
 *
 * Initialised lazily: `neon()` throws when DATABASE_URL is missing, and
 * Next.js evaluates top-level module code during `next build`, so a
 * module-scope client would break any build run before the env is present.
 *
 * Deliberately a plain function rather than a Proxy wrapper - Proxies around
 * the client break libraries that introspect the adapter object.
 */
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

/**
 * Neon is reached over HTTP, so a stalled connection surfaces as a hung fetch.
 * Undici's default header timeout is five minutes, which meant a single blip
 * under load parked a page render for minutes before finally returning a 500.
 * The timeout below is the main fix: fail in seconds, not minutes.
 *
 * Retries are deliberately narrow, and split by what is safe to replay:
 *
 * - Connection failures cannot have had any effect, so they always retry.
 * - Timeouts may mean the query reached the database and only the response was
 *   lost. Replaying an insert would write the row twice, so a timeout is only
 *   retried when the statement is a SELECT. Neon sends one statement per
 *   request, so reading the verb off the body is enough to know.
 *
 * Without the second rule a single slow moment failed the request outright,
 * even for a read where trying again costs nothing.
 */
function neverConnected(error: unknown): boolean {
  const code = (error as { cause?: { code?: string } })?.cause?.code;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ECONNRESET";
}

function isReadOnly(init?: RequestInit): boolean {
  const body = init?.body;
  if (typeof body !== "string") return false;
  try {
    const query = (JSON.parse(body) as { query?: string }).query ?? "";
    // A CTE can still write, so "with" is not treated as read-only.
    return /^\s*select\b/i.test(query);
  } catch {
    return false;
  }
}

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      lastError = error;
      const retryable = neverConnected(error) || isReadOnly(init);
      if (attempt === MAX_ATTEMPTS || !retryable) break;
      // Back off a little so a momentarily overloaded endpoint gets room.
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // fetchFunction is global config on the driver, not a per-connection option.
  neonConfig.fetchFunction = resilientFetch;
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!cached) cached = createDb();
  return cached;
}

export { schema };
