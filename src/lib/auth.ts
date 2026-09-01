import "server-only";

/**
 * Resolves the caller's identity for data scoping.
 *
 * Clerk is provisioned on this project (CLERK_SECRET_KEY is present) but is not
 * yet wired into the app, so this is the seam that real session lookup drops
 * into. Until then it falls back to a single demo tenant, and every query still
 * scopes by whatever this returns — so switching to Clerk changes this function
 * and nothing else.
 */
export async function currentUserId(): Promise<string> {
  return process.env.SEED_USER_ID ?? "demo-user";
}
