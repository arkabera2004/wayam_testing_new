import { NextResponse } from "next/server";

import { KNOWN_EMAIL } from "../../store-constants";

/**
 * Sign-up for the demo storefront.
 *
 * The storefront needs a real server call somewhere for cross-layer reasoning
 * to have a second layer to reason about. A UI assertion failure looks the
 * same whether the element is missing because this returned 500 or because it
 * was renamed - which is exactly the ambiguity that has to be resolved by
 * looking underneath the UI.
 */
export async function POST(request: Request) {
  // Lets a run reproduce a server fault without editing the page.
  if (process.env.SHOPSTACK_SIGNUP_FAIL === "1") {
    return NextResponse.json({ error: "Account service unavailable." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "An email is required." }, { status: 400 });
  }
  if (email === KNOWN_EMAIL) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }
  return NextResponse.json({ created: true }, { status: 201 });
}
