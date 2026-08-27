import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import {
  createOrganization,
  listMyOrganizations,
  requireOrgAdmin,
  requireOrgMember,
} from "@/lib/data/org-access.server";
import { getCurrentOrgIdFromCookie, setCurrentOrgCookie } from "./current-org.server";

export interface PublicOrganization {
  id: string;
  name: string;
}

export interface PublicMember {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  pending: boolean;
}

function toPublicOrg(org: { _id: ObjectId; name: string }): PublicOrganization {
  return { id: org._id.toString(), name: org.name };
}

/** Onboarding step 1: create the organization and make the caller its
 * admin. Also sets the "current org" cookie so the rest of onboarding
 * (and the app after it) knows which org to act on. */
export const createOrganizationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().trim().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const org = await createOrganization(db, context.user._id, data.name);
    setCurrentOrgCookie(org._id.toString());
    return toPublicOrg(org);
  });

/** Invite a teammate by email (used from onboarding and Settings >
 * Members). If the invitee doesn't have an account yet, the invite is
 * auto-accepted the moment they sign up with this email — see
 * signUp in auth/functions.ts. If they already have an account, they
 * still need to be added — see getOrgMembersFn, which surfaces pending
 * invites separately from active members in the UI. */
export const inviteMemberFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      email: z.string().email(),
      role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgAdmin(db, orgId, context.user._id);

    const email = data.email.toLowerCase().trim();
    const { organizationInvites } = collections(db);
    await organizationInvites.updateOne(
      { orgId, email },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          orgId,
          email,
          role: data.role,
          invitedBy: context.user._id,
          createdAt: new Date(),
          acceptedAt: null,
        },
      },
      { upsert: true },
    );

    return { ok: true };
  });

export const getMyOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await getDb();
    const orgs = await listMyOrganizations(db, context.user._id);
    return orgs.map(toPublicOrg);
  });

/** Resolves "the org this request is acting on": the cookie if it still
 * points at an org the user belongs to, otherwise their first org
 * (re-pinning the cookie), otherwise null if they have none yet. */
export const getCurrentOrganizationFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await getDb();
    const orgs = await listMyOrganizations(db, context.user._id);
    if (orgs.length === 0) return null;

    const cookieOrgId = getCurrentOrgIdFromCookie();
    const matching = cookieOrgId && orgs.find((o) => o._id.toString() === cookieOrgId);
    const org = matching || orgs[0]!;

    setCurrentOrgCookie(org._id.toString());
    return toPublicOrg(org);
  });

export const updateOrganizationNameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgAdmin(db, orgId, context.user._id);

    await collections(db).organizations.updateOne(
      { _id: orgId },
      { $set: { name: data.name, updatedAt: new Date() } },
    );
    return toPublicOrg({ _id: orgId, name: data.name });
  });

/** Active members (joined against the users collection for display name/
 * email) plus anyone with a pending invite that hasn't been accepted yet
 * — the UI shows both in one list, distinguished by `pending`. */
export const getOrgMembersFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const { organizationMembers, organizationInvites, users } = collections(db);
    const [memberships, invites] = await Promise.all([
      organizationMembers.find({ orgId }).toArray(),
      organizationInvites.find({ orgId, acceptedAt: null }).toArray(),
    ]);
    const userDocs = await users
      .find({ _id: { $in: memberships.map((m) => m.userId) } })
      .toArray();
    const userById = new Map(userDocs.map((u) => [u._id.toString(), u]));

    const activeMembers: PublicMember[] = memberships.map((m) => {
      const user = userById.get(m.userId.toString());
      return {
        id: m._id.toString(),
        userId: m.userId.toString(),
        name: user?.fullName || user?.email || "Unknown",
        email: user?.email ?? "unknown",
        role: m.role,
        pending: false,
      };
    });
    const pendingInvites: PublicMember[] = invites.map((invite) => ({
      id: invite._id.toString(),
      userId: null,
      name: invite.email,
      email: invite.email,
      role: invite.role,
      pending: true,
    }));

    return [...activeMembers, ...pendingInvites];
  });

export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      membershipId: z.string(),
      role: z.enum(["admin", "editor", "viewer"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgAdmin(db, orgId, context.user._id);

    await collections(db).organizationMembers.updateOne(
      { _id: new ObjectId(data.membershipId), orgId },
      { $set: { role: data.role } },
    );
    return { ok: true };
  });
