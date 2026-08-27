import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "@/integrations/mongodb/client.server";
import { collections } from "@/integrations/mongodb/collections.server";
import type { IntegrationDoc, IntegrationProvider } from "@/integrations/mongodb/schema";
import { authMiddleware } from "@/lib/auth/auth-middleware";
import { requireOrgMember, requireOrgWrite } from "@/lib/data/org-access.server";

export type IntegrationConfig = Record<string, string | number | boolean | null>;

export interface PublicIntegration {
  provider: IntegrationProvider;
  connected: boolean;
  config: IntegrationConfig;
}

const ALL_PROVIDERS: IntegrationProvider[] = ["github", "slack", "jira"];

// IntegrationDoc.config is typed as a generic Record<string, unknown> in
// the schema (it's a free-form bag with no fixed shape across providers),
// but every write in this file only ever puts serializable primitives into
// it — the narrower cast just reflects that guarantee at the API boundary.
function toPublicIntegration(doc: IntegrationDoc | null, provider: IntegrationProvider): PublicIntegration {
  return {
    provider,
    connected: doc?.status === "connected",
    config: (doc?.config as IntegrationConfig | undefined) ?? {},
  };
}

// INTEGRATION POINT: "connecting" here just flips a status flag — there's
// no real OAuth handshake with GitHub/Slack/Jira. A real implementation
// would redirect through each provider's OAuth flow and populate `config`
// (repo, channel, project key, webhook secret, etc.) from the callback,
// but the shape below (one doc per org+provider, connected/not_connected +
// a free-form config bag) is already what that would write into.
export const listIntegrationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ context, data }): Promise<PublicIntegration[]> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgMember(db, orgId, context.user._id);

    const docs = await collections(db).integrations.find({ orgId }).toArray();
    const docByProvider = new Map(docs.map((d) => [d.provider, d]));
    return ALL_PROVIDERS.map((provider) => toPublicIntegration(docByProvider.get(provider) ?? null, provider));
  });

export const toggleIntegrationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), provider: z.enum(["github", "slack", "jira"]) }))
  .handler(async ({ context, data }): Promise<PublicIntegration> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgWrite(db, orgId, context.user._id);

    const { integrations } = collections(db);
    const existing = await integrations.findOne({ orgId, provider: data.provider });
    const nextStatus = existing?.status === "connected" ? "not_connected" : "connected";
    // Disconnecting clears config — reconnecting starts from a clean slate,
    // same as a real OAuth flow would after a token revocation.
    const nextConfig: IntegrationConfig =
      nextStatus === "connected" ? ((existing?.config as IntegrationConfig | undefined) ?? {}) : {};

    const now = new Date();
    await integrations.updateOne(
      { orgId, provider: data.provider },
      {
        $set: { status: nextStatus, config: nextConfig, updatedAt: now },
        $setOnInsert: { _id: new ObjectId(), orgId, provider: data.provider, createdAt: now },
      },
      { upsert: true },
    );

    return { provider: data.provider, connected: nextStatus === "connected", config: nextConfig };
  });

export const updateIntegrationConfigFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      provider: z.enum(["github", "slack", "jira"]),
      config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await getDb();
    const orgId = new ObjectId(data.orgId);
    await requireOrgWrite(db, orgId, context.user._id);

    await collections(db).integrations.updateOne(
      { orgId, provider: data.provider },
      { $set: { config: data.config, updatedAt: new Date() } },
    );
    return { ok: true };
  });
