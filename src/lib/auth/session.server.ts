// Opaque, server-looked-up sessions: the cookie holds nothing but a random
// token, never a JWT. MongoDB is the source of truth for who that token
// belongs to and whether it's still valid, so revoking a session (logout,
// password change) takes effect immediately everywhere — nothing to wait
// out until a token "expires" client-side.
import crypto from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import type { ObjectId } from "mongodb";

import { getDb } from "../../integrations/mongodb/client.server.ts";
import { collections } from "../../integrations/mongodb/collections.server.ts";
import type { UserDoc } from "../../integrations/mongodb/schema.ts";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// The __Host- prefix (binds the cookie to this exact origin, blocking
// subdomain takeover) requires the Secure flag, which browsers refuse to
// persist over plain http — i.e. local dev. Compute both per-request
// (never at module scope: this file can run on edge runtimes where env is
// only available inside a request) so dev keeps working and prod gets the
// hardened cookie.
function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function sessionCookieName(): string {
  return isProduction() ? "__Host-parikshan-session" : "parikshan-session";
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createSession(userId: ObjectId): Promise<string> {
  const db = await getDb();
  const token = generateToken();
  const now = new Date();
  await collections(db).sessions.insertOne({
    _id: token,
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export function setSessionCookie(token: string): void {
  setCookie(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(sessionCookieName(), { path: "/" });
}

/** The raw token for the current request, if any — used by logout to
 * revoke exactly this session rather than every session for the user. */
export function getCurrentSessionToken(): string | null {
  return getCookie(sessionCookieName()) ?? null;
}

export async function revokeSession(token: string): Promise<void> {
  const db = await getDb();
  await collections(db).sessions.deleteOne({ _id: token });
}

/** Called on login and on any privilege change, so a session fixed into the
 * victim's browser before login (or before a role change) stops working. */
export async function revokeAllSessionsForUser(userId: ObjectId): Promise<void> {
  const db = await getDb();
  await collections(db).sessions.deleteMany({ userId });
}

/** Reads the session cookie, looks it up, and returns the user it belongs
 * to — or null if there's no cookie, the session expired, or the user was
 * deleted. This is the only function anything should trust as "who is
 * making this request." */
export async function getSessionUser(): Promise<UserDoc | null> {
  const token = getCookie(sessionCookieName());
  if (!token) return null;

  const db = await getDb();
  const { sessions, users } = collections(db);
  const session = await sessions.findOne({ _id: token });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await sessions.deleteOne({ _id: token });
    return null;
  }

  return users.findOne({ _id: session.userId });
}
