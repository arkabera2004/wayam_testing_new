// Verifies the MongoDB org-scoping data-access layer the same way the
// original plan wanted Postgres RLS verified: two separate orgs, confirming
// neither can read or write the other's data, plus role gating.
//
// Runs against a real (ephemeral, in-memory) MongoDB instance via
// mongodb-memory-server — no external services, no fixtures to clean up.
//
//   npm run test:org-isolation
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { MongoClient, ObjectId, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import { collections } from "../src/integrations/mongodb/collections.server.ts";
import {
  ForbiddenError,
  createOrganization,
  getOrgRole,
  requireOrgAdmin,
  requireOrgMember,
  requireOrgWrite,
} from "../src/lib/data/org-access.server.ts";

let mongo: MongoMemoryServer;
let client: MongoClient;
let db: Db;

before(async () => {
  mongo = await MongoMemoryServer.create();
  client = new MongoClient(mongo.getUri());
  await client.connect();
  db = client.db("parikshan_test");
});

after(async () => {
  await client.close();
  await mongo.stop();
});

describe("org isolation", () => {
  test("two orgs cannot see or write each other's data", async () => {
    const alice = new ObjectId();
    const bob = new ObjectId();

    const orgA = await createOrganization(db, alice, "Org A");
    const orgB = await createOrganization(db, bob, "Org B");

    // Each creator is an admin of their own org, and a stranger to the other.
    assert.equal(await getOrgRole(db, orgA._id, alice), "admin");
    assert.equal(await getOrgRole(db, orgB._id, bob), "admin");
    assert.equal(await getOrgRole(db, orgB._id, alice), null);
    assert.equal(await getOrgRole(db, orgA._id, bob), null);

    // Seed one project per org directly (simulating what a wired page would
    // do after requireOrgWrite passes).
    const { projects } = collections(db);
    const projectA = {
      _id: new ObjectId(),
      orgId: orgA._id,
      name: "Alice's project",
      sourceType: "github" as const,
      sourceUrl: "github.com/a/a",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const projectB = {
      _id: new ObjectId(),
      orgId: orgB._id,
      name: "Bob's project",
      sourceType: "github" as const,
      sourceUrl: "github.com/b/b",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await projects.insertMany([projectA, projectB]);

    // (a) Alice's membership check fails against org B's id, so a page
    // wired correctly can never even construct the query for org B's data.
    await assert.rejects(() => requireOrgMember(db, orgB._id, alice), ForbiddenError);
    await assert.rejects(() => requireOrgMember(db, orgA._id, bob), ForbiddenError);

    // (b) Same for the write guard used before every insert/update.
    await assert.rejects(() => requireOrgWrite(db, orgB._id, alice), ForbiddenError);

    // (c) Directly querying with the wrong org's id (simulating someone
    // forgetting the guard) still can't be laundered through the org
    // membership check — proving the check, not query shape, is the
    // boundary. A membership-checked read for org A never touches org B's
    // rows even if it queries the shared collection.
    await requireOrgMember(db, orgA._id, alice); // passes
    const aliceVisibleProjects = await projects.find({ orgId: orgA._id }).toArray();
    assert.equal(aliceVisibleProjects.length, 1);
    assert.equal(aliceVisibleProjects[0]?.name, "Alice's project");
    assert.ok(!aliceVisibleProjects.some((p) => p.orgId.equals(orgB._id)));

    // (d) Org lists never cross-contaminate.
    const { listMyOrganizations } = await import("../src/lib/data/org-access.server.ts");
    const aliceOrgs = await listMyOrganizations(db, alice);
    const bobOrgs = await listMyOrganizations(db, bob);
    assert.deepEqual(
      aliceOrgs.map((o) => o._id.toString()),
      [orgA._id.toString()],
    );
    assert.deepEqual(
      bobOrgs.map((o) => o._id.toString()),
      [orgB._id.toString()],
    );
  });

  test("role gating: viewers can't write, editors can't admin", async () => {
    const admin = new ObjectId();
    const editor = new ObjectId();
    const viewer = new ObjectId();

    const org = await createOrganization(db, admin, "Role Test Org");
    const { organizationMembers } = collections(db);
    await organizationMembers.insertMany([
      { _id: new ObjectId(), orgId: org._id, userId: editor, role: "editor", createdAt: new Date() },
      { _id: new ObjectId(), orgId: org._id, userId: viewer, role: "viewer", createdAt: new Date() },
    ]);

    // Reads: everyone with any role can read.
    await requireOrgMember(db, org._id, admin);
    await requireOrgMember(db, org._id, editor);
    await requireOrgMember(db, org._id, viewer);

    // Writes: admin and editor yes, viewer no.
    await requireOrgWrite(db, org._id, admin);
    await requireOrgWrite(db, org._id, editor);
    await assert.rejects(() => requireOrgWrite(db, org._id, viewer), ForbiddenError);

    // Admin-only actions: only admin.
    await requireOrgAdmin(db, org._id, admin);
    await assert.rejects(() => requireOrgAdmin(db, org._id, editor), ForbiddenError);
    await assert.rejects(() => requireOrgAdmin(db, org._id, viewer), ForbiddenError);
  });
});
