// Production/dev MongoDB connection. Server-only — never import this from a
// route component or anything that ships to the client bundle.
//
// Data-access functions (src/lib/data/*.server.ts) take a `Db` as an
// explicit parameter rather than importing this module directly, so tests
// can hand them a `mongodb-memory-server` Db instead. Route/server-function
// call sites use `getDb()` to obtain the real one.
import { MongoClient, type Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __parikshanMongoClientPromise: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Set it in .env (see .env for the local-dev default).",
    );
  }
  return new MongoClient(uri).connect();
}

export async function getMongoClient(): Promise<MongoClient> {
  // Cache the connecting client on globalThis (not a module-level variable)
  // so Vite's dev-mode HMR — which gives this module a fresh instance on
  // every save — doesn't spawn a new connection pool each time.
  if (!globalThis.__parikshanMongoClientPromise) {
    globalThis.__parikshanMongoClientPromise = connect();
  }
  return globalThis.__parikshanMongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env["MONGODB_DB_NAME"] || "parikshan");
}
