import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserOrNull } from "@/lib/auth/functions";
import { getCurrentOrganizationFn } from "@/lib/org/functions";

export const Route = createFileRoute("/_app")({
  // Route UX, not the data boundary: every server function that reads/writes
  // private data still enforces auth itself via authMiddleware. This just
  // keeps a signed-out visitor from seeing the app shell flash before the
  // redirect.
  beforeLoad: async () => {
    const user = await getCurrentUserOrNull();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    // null until the org-creation step (onboarding) has run; pages below
    // this layout that need an org handle that empty state themselves.
    const org = await getCurrentOrganizationFn();
    return { user, org };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user, org } = Route.useRouteContext();
  return <AppShell user={user} org={org} />;
}
