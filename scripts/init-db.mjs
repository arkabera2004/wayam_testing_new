#!/usr/bin/env node
// Creates indexes (including the uniqueness constraints that used to be
// Postgres `unique` columns) for a MongoDB deployment. Run once against a
// new database:
//
//   node --env-file=.env scripts/init-db.mjs
//
// Safe to re-run — createIndex is a no-op if an identical index exists.
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "parikshan";

if (!uri) {
  console.error("Missing MONGODB_URI. Pass it via --env-file=.env or export it directly.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db(dbName);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  await db
    .collection("organization_members")
    .createIndex({ orgId: 1, userId: 1 }, { unique: true });
  await db.collection("organization_members").createIndex({ userId: 1 });
  await db.collection("organization_members").createIndex({ orgId: 1 });

  await db
    .collection("organization_invites")
    .createIndex({ orgId: 1, email: 1 }, { unique: true });
  await db.collection("organization_invites").createIndex({ email: 1 });

  // TTL index: sessions are deleted automatically once expiresAt passes.
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("sessions").createIndex({ userId: 1 });

  await db.collection("projects").createIndex({ orgId: 1 });
  await db.collection("test_plans").createIndex({ orgId: 1 });
  await db.collection("test_plans").createIndex({ projectId: 1 });
  await db.collection("test_scenarios").createIndex({ orgId: 1 });
  await db.collection("test_scenarios").createIndex({ testPlanId: 1 });
  await db.collection("test_cases").createIndex({ orgId: 1 });
  await db.collection("test_cases").createIndex({ scenarioId: 1 });
  await db.collection("test_runs").createIndex({ orgId: 1 });
  await db.collection("test_runs").createIndex({ projectId: 1 });
  await db.collection("run_results").createIndex({ orgId: 1 });
  await db.collection("run_results").createIndex({ runId: 1 });
  await db.collection("run_results").createIndex({ testCaseId: 1 });

  await db
    .collection("integrations")
    .createIndex({ orgId: 1, provider: 1 }, { unique: true });

  await db.collection("api_keys").createIndex({ orgId: 1 });

  console.log(`Indexes created on database "${dbName}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
