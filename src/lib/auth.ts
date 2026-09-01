import "server-only";

import { auth } from "@clerk/nextjs/server";

/**
 * The signed-in user's id, used to scope every database read.
 *
 * Throws rather than falling back to a shared tenant: middleware already
 * guarantees a session on every protected route, so no session here means a
 * routing mistake, and silently returning a default id would serve one user's
 * data to another.
 */
export async function currentUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("No active session");
  return userId;
}

/** Null instead of throwing, for the few places that render either way. */
export async function optionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}
