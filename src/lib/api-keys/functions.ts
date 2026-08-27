import crypto from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { ApiKeyDoc } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgAdmin, requireOrgMember } from "@/lib/data/org-access.server";

export interface PublicApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function toPublicApiKey(doc: ApiKeyDoc): PublicApiKey {
  return {
    id: doc._id.toString(),
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
  };
}

// API key secrets are high-entropy random tokens, not user-chosen
// passwords — a fast cryptographic hash (SHA-256) is the right tool here,
// not bcrypt's deliberately-slow KDF (which is for defending low-entropy
// user passwords against offline dictionary attacks).
function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export const listApiKeysFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const keys = await collections(db)
      .apiKeys.find({ orgId, revokedAt: null })
      .sort({ createdAt: -1 })
      .toArray();
    return keys.map(toPublicApiKey);
  });

/** Returns the full plaintext key exactly once — only the hash is ever
 * stored, so this is the only response that will ever contain it. */
export const generateApiKeyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgAdmin(db, orgId, context.user._id);

    const secret = crypto.randomBytes(24).toString("base64url");
    const plaintextKey = `pk_live_${secret}`;
    const keyPrefix = plaintextKey.slice(0, 12);

    const doc: ApiKeyDoc = {
      _id: new ObjectId(),
      orgId,
      name: data.name,
      keyPrefix,
      keyHash: hashApiKey(plaintextKey),
      createdBy: context.user._id,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    };
    await collections(db).apiKeys.insertOne(doc);

    return { ...toPublicApiKey(doc), plaintextKey };
  });

export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), keyId: z.string() }))
  .handler(async ({ context, data }) => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgAdmin(db, orgId, context.user._id);

    await collections(db).apiKeys.updateOne(
      { _id: new ObjectId(data.keyId), orgId },
      { $set: { revokedAt: new Date() } },
    );
    return { ok: true };
  });
