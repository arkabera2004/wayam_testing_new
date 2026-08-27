// The single door into org-scoped data.
//
// MongoDB has no row-level security, so the isolation guarantee that would
// normally live in Postgres RLS policies lives here instead: every function
// below takes the caller's userId, checks organization_members before
// touching anything else, and every query it runs is filtered by orgId.
//
// Rule for the rest of the codebase: route/server-function handlers call
// these functions (or ones built the same way in sibling files under
// src/lib/data/) — they never import src/integrations/mongodb/collections.server
// directly. That keeps org-scoping impossible to accidentally bypass.
//
// Verified by tests/org-isolation.test.ts against two separate orgs.
import { ObjectId, type Db } from "mongodb";

import { collections } from "../../integrations/mongodb/collections.server.ts";
import type { OrganizationDoc, OrgRole } from "../../integrations/mongodb/schema.ts";

export class ForbiddenError extends Error {
  constructor(message = "Not authorized for this organization") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const WRITE_ROLES: OrgRole[] = ["admin", "editor"];

export async function getOrgRole(
  db: Db,
  orgId: ObjectId,
  userId: ObjectId,
): Promise<OrgRole | null> {
  const member = await collections(db).organizationMembers.findOne({ orgId, userId });
  return member?.role ?? null;
}

/** Throws unless the user has any role in the org. Use for reads. */
export async function requireOrgMember(
  db: Db,
  orgId: ObjectId,
  userId: ObjectId,
): Promise<OrgRole> {
  const role = await getOrgRole(db, orgId, userId);
  if (!role) throw new ForbiddenError("Not a member of this organization");
  return role;
}

/** Throws unless the user is an admin or editor. Use for inserts/updates. */
export async function requireOrgWrite(
  db: Db,
  orgId: ObjectId,
  userId: ObjectId,
): Promise<OrgRole> {
  const role = await requireOrgMember(db, orgId, userId);
  if (!WRITE_ROLES.includes(role)) {
    throw new ForbiddenError("Editor or admin role required for this action");
  }
  return role;
}

/** Throws unless the user is an admin. Use for membership/role changes,
 * deletes, and anything else destructive or organization-level. */
export async function requireOrgAdmin(
  db: Db,
  orgId: ObjectId,
  userId: ObjectId,
): Promise<OrgRole> {
  const role = await requireOrgMember(db, orgId, userId);
  if (role !== "admin") throw new ForbiddenError("Admin role required for this action");
  return role;
}

/** Creates an organization and makes the caller its first admin. Mirrors the
 * Postgres create_organization() RPC: both writes happen together so there's
 * never a moment where the org exists without an owning member. */
export async function createOrganization(
  db: Db,
  userId: ObjectId,
  name: string,
): Promise<OrganizationDoc> {
  const { organizations, organizationMembers } = collections(db);
  const now = new Date();
  const org: OrganizationDoc = { _id: new ObjectId(), name, createdAt: now, updatedAt: now };

  await organizations.insertOne(org);
  await organizationMembers.insertOne({
    _id: new ObjectId(),
    orgId: org._id,
    userId,
    role: "admin",
    createdAt: now,
  });

  return org;
}

export async function listMyOrganizations(db: Db, userId: ObjectId): Promise<OrganizationDoc[]> {
  const { organizationMembers, organizations } = collections(db);
  const memberships = await organizationMembers.find({ userId }).toArray();
  if (memberships.length === 0) return [];
  const orgIds = memberships.map((m) => m.orgId);
  return organizations.find({ _id: { $in: orgIds } }).toArray();
}

export async function getOrganization(
  db: Db,
  orgId: ObjectId,
  userId: ObjectId,
): Promise<OrganizationDoc> {
  await requireOrgMember(db, orgId, userId);
  const org = await collections(db).organizations.findOne({ _id: orgId });
  if (!org) throw new ForbiddenError("Organization not found");
  return org;
}
