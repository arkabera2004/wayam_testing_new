/**
 * Database client.
 *
 * Initialised lazily: `neon()` throws when DATABASE_URL is missing, and
 * Next.js evaluates top-level module code during `next build`, so a
 * module-scope client would break any build run before the env is present.
 *
 * Deliberately a plain function rather than a Proxy wrapper — Proxies around
 * the client break libraries that introspect the adapter object.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!cached) cached = createDb();
  return cached;
}

export { schema };
