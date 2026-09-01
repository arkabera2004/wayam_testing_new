import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * The marketing site, auth screens and the health check stay public; every
 * other route requires a session.
 *
 * Listing what is public rather than what is protected means a route added
 * later is private by default — a new page under /projects cannot leak by
 * being forgotten here.
 */
const isPublic = createRouteMatcher(["/", "/pricing", "/login(.*)", "/signup(.*)", "/api/health"]);
const isApi = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;

  const { userId, redirectToSignIn } = await auth();
  if (userId) return;

  // `auth.protect()` answers 404 for an unauthenticated page request, which
  // reads as "no such page" rather than "please sign in". Send browsers to the
  // sign-in screen and keep where they were headed; answer API callers with a
  // status they can act on instead of a redirect to HTML.
  if (isApi(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return redirectToSignIn({ returnBackUrl: req.url });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
