import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/components/layout/logo";

/**
 * Branding and layout for the sign-in and sign-up screens.
 *
 * This used to render a mock form with a link where the submit button should
 * be. Clerk now owns the credential handling, so the shell keeps the framing —
 * logo, heading, the cross-link between the two modes — and hosts the widget as
 * children.
 */
export function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const isSignup = mode === "signup";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="border-muted bg-container rounded-xl border p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={56} />
          <div>
            <h1 className="text-heading-md text-primary">{title}</h1>
            <p className="text-body-md text-tertiary mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="mt-6">{children}</div>
      </div>

      <p className="text-caption text-quaternary mt-6 text-center">A Wayam AI product</p>

      <p className="text-body-md text-tertiary mt-5 text-center">
        {isSignup ? "Already have an account? " : "New to Parikshan? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-secondary hover:text-primary underline underline-offset-4"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
