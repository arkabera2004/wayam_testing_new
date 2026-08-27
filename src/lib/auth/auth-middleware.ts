// Attach to every server function that reads or writes private data.
// Route guards (the _app beforeLoad redirect) are UX, not the security
// boundary — a server function is reachable directly regardless of which
// route calls it, so it must check its own auth.
import { createMiddleware } from "@tanstack/react-start";

import { getSessionUser } from "./session.server.ts";

export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return next({ context: { user } });
});
