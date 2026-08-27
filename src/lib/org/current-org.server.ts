// Which organization the signed-in user is "currently" acting as. The
// cookie is just a hint for which org to show by default — it carries no
// authority on its own. Every actual read/write still re-checks membership
// via org-access.server.ts, so a tampered or stale cookie value can only
// ever result in a 403 (ForbiddenError), never a cross-org leak.
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

const CURRENT_ORG_COOKIE = "parikshan-current-org";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function getCurrentOrgIdFromCookie(): string | null {
  return getCookie(CURRENT_ORG_COOKIE) ?? null;
}

export function setCurrentOrgCookie(orgId: string): void {
  setCookie(CURRENT_ORG_COOKIE, orgId, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export function clearCurrentOrgCookie(): void {
  deleteCookie(CURRENT_ORG_COOKIE, { path: "/" });
}
