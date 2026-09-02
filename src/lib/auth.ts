import "server-only";

/**
 * Identity for scoping database reads.
 *
 * Authentication is deliberately out of the app right now - the focus is on
 * the testing pipeline, so every request runs as one local tenant and the
 * seeded project is reachable without signing in.
 *
 * Every query already takes this value and scopes by it, so restoring real
 * sessions is a change to this function rather than to any caller. Do not
 * deploy this publicly as-is: it makes all data readable to anyone.
 */
export const LOCAL_TENANT = "demo-user";

export async function currentUserId(): Promise<string> {
  return process.env.SEED_USER_ID ?? LOCAL_TENANT;
}
