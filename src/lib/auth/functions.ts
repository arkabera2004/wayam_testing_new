// Auth RPCs: sign up, log in, log out, and "who am I". These are the only
// places password hashing and session issuance happen — every other server
// function that needs the caller's identity goes through authMiddleware
// (session.server.ts / auth-middleware.ts), not these directly.
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "../../integrations/mongodb/client.server.ts";
import { collections } from "../../integrations/mongodb/collections.server.ts";
import { hashPassword, verifyPassword } from "./password.server.ts";
import {
  clearSessionCookie,
  createSession,
  getCurrentSessionToken,
  revokeAllSessionsForUser,
  revokeSession,
  setSessionCookie,
} from "./session.server.ts";
import { authMiddleware } from "./auth-middleware.ts";

export interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
}

function toPublicUser(user: { _id: ObjectId; email: string; fullName: string | null }): PublicUser {
  return { id: user._id.toString(), email: user.email, fullName: user.fullName };
}

export const signUp = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      fullName: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const { users } = collections(db);
    const email = data.email.toLowerCase().trim();

    const existing = await users.findOne({ email });
    if (existing) {
      // Same message as a failed login — don't confirm whether the email
      // is already registered.
      throw new Error("Could not create an account with that email");
    }

    const passwordHash = await hashPassword(data.password);
    const user = {
      _id: new ObjectId(),
      email,
      passwordHash,
      fullName: data.fullName.trim(),
      createdAt: new Date(),
    };
    await users.insertOne(user);

    const token = await createSession(user._id);
    setSessionCookie(token);

    return toPublicUser(user);
  });

export const logIn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = await getDb();
    const { users } = collections(db);
    const email = data.email.toLowerCase().trim();
    const user = await users.findOne({ email });

    // Always run verifyPassword — even when no user matches — so a
    // nonexistent-email attempt takes the same time as a wrong-password
    // one and can't be used to enumerate registered emails.
    const passwordMatches = await verifyPassword(user?.passwordHash, data.password);
    if (!user || !passwordMatches) {
      throw new Error("Invalid email or password");
    }

    // Rotate on login: destroy any session fixed into this browser before
    // authentication, then issue a fresh one.
    await revokeAllSessionsForUser(user._id);
    const token = await createSession(user._id);
    setSessionCookie(token);

    return toPublicUser(user);
  });

export const logOut = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCurrentSessionToken();
  if (token) await revokeSession(token);
  clearSessionCookie();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => toPublicUser(context.user));

/** Non-throwing variant for places (like the root route guard) that just
 * want to know "is anyone logged in" without erroring when nobody is. */
export const getCurrentUserOrNull = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
});
