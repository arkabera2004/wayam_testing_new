import Link from "next/link";

import { Button, cn } from "@/components/ui";
import { Logo } from "@/components/layout/logo";

function Field({
  id,
  label,
  type = "text",
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md text-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={cn(
          "border-muted bg-raised text-body-md text-primary placeholder:text-quaternary",
          "h-9 rounded-lg border px-3",
          "focus-visible:border-active focus-visible:outline-none",
        )}
      />
    </div>
  );
}

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="border-muted bg-container rounded-xl border p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={56} />
          <div>
            <h1 className="text-heading-md text-primary">
              {isSignup ? "Create your workspace" : "Welcome back"}
            </h1>
            <p className="text-body-md text-tertiary mt-1">
              {isSignup
                ? "Your first suite is about ten minutes away."
                : "Sign in to your Parikshan workspace."}
            </p>
          </div>
        </div>

        <Link href={isSignup ? "/onboarding" : "/projects"} className="mt-6 block">
          <Button variant="primary" icon="github" className="h-9 w-full">
            Continue with GitHub
          </Button>
        </Link>

        <div className="my-5 flex items-center gap-3">
          <span className="border-muted h-px flex-1 border-t" />
          <span className="text-caption text-quaternary">or</span>
          <span className="border-muted h-px flex-1 border-t" />
        </div>

        <form className="flex flex-col gap-4">
          {isSignup ? (
            <Field id="workspace" label="Workspace name" defaultValue="Acme Inc" />
          ) : null}
          <Field id="email" label="Email" type="email" placeholder="you@company.com" />
          <Field id="password" label="Password" type="password" placeholder="••••••••" />

          <Link href={isSignup ? "/onboarding" : "/projects"}>
            <Button variant="secondary" className="h-9 w-full">
              {isSignup ? "Create workspace" : "Log in"}
            </Button>
          </Link>
        </form>

        <p className="text-body-sm text-tertiary mt-5 text-center">
          <a href="#" className="hover:text-primary underline underline-offset-4">
            Single sign-on
          </a>
        </p>
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
