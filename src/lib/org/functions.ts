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
} from "@/lib/data/org-access.server";
import { getCurrentOrgIdFromCookie, setCurrentOrgCookie } from "./current-org.server";

export interface PublicOrganization {
  id: string;
  name: string;
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

/** Onboarding step 2 (optional): invite a teammate by email. If they
 * already have an account, org-access's signup trigger equivalent doesn't
 * exist for Mongo — instead getCurrentUser-adjacent signup flow checks
 * organization_invites for a match (see signUp in auth/functions.ts... not
 * yet — tracked as an INTEGRATION POINT below until that's wired). */
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
