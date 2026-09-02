/**
 * Re-points the seeded demo project at a real Clerk user.
 *
 * The seed originally landed under the literal tenant "demo-user", which no
 * Clerk account can ever match, so those rows became unreachable once reads
 * were scoped to the session. This moves the project (and with it the suites,
 * cases, runs and results that hang off it) to a real user id.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/reassign-seed.mts user_xxx [--from demo-user]
 */
import { and, eq } from "drizzle-orm";

import { getDb, schema } from "../src/db/index.js";

const [target, ...rest] = process.argv.slice(2);
const fromFlag = rest.indexOf("--from");
const from = fromFlag >= 0 ? rest[fromFlag + 1] : "demo-user";

if (!target || !target.startsWith("user_")) {
  console.error(
    "Usage: reassign-seed.mts <clerk_user_id> [--from <current_owner>]\n" +
      "The target must be a Clerk user id beginning with 'user_'.",
  );
  process.exit(1);
}

const db = getDb();

const owned = await db.select().from(schema.projects).where(eq(schema.projects.userId, from));
if (owned.length === 0) {
  console.log(`Nothing owned by "${from}" - nothing to move.`);
  process.exit(0);
}

// Guard against colliding with a project the target already has by that name.
for (const p of owned) {
  const [clash] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, target), eq(schema.projects.name, p.name)))
    .limit(1);
  if (clash) {
    console.error(`"${target}" already has a project named "${p.name}" (${clash.id}). Aborting.`);
    process.exit(1);
  }
}

const moved = await db
  .update(schema.projects)
  .set({ userId: target, updatedAt: new Date() })
  .where(eq(schema.projects.userId, from))
  .returning({ id: schema.projects.id, name: schema.projects.name });

for (const p of moved) console.log(`moved ${p.name} (${p.id}) -> ${target}`);
console.log(
  `\nSuites, cases, runs and results follow the project, so ${moved.length} project(s) are now visible to that account.`,
);
