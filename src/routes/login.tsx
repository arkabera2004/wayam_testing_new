import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { logIn, signUp } from "@/lib/auth/functions";
import { WayamMark } from "@/components/brand/wayam-mark";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

/** Demo-only: generates a fresh random email + password so a visitor can
 * see the product without typing anything. Not a real credential — it
 * exists purely to spin up a throwaway account for the session. */
function randomDemoCredentials() {
  const suffix = crypto.randomUUID().slice(0, 8);
  return {
    email: `demo-${suffix}@parikshan.demo`,
    password: crypto.randomUUID(),
  };
}

// INTEGRATION POINT: the Google button below is still a visual stub — no
// OAuth flow wired. Email/password below is real (bcrypt + Mongo-backed
// session, see src/lib/auth).
function LoginPage() {
  const navigate = useNavigate();
  const logInFn = useServerFn(logIn);
  const signUpFn = useServerFn(signUp);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await logInFn({
        data: {
          email: String(form.get("email")),
          password: String(form.get("password")),
        },
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setDemoLoading(true);
    try {
      const { email, password } = randomDemoCredentials();
      await signUpFn({ data: { fullName: "Demo User", email, password } });
      navigate({ to: "/onboarding" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo");
      setDemoLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <WayamMark className="h-12 w-12" />
          <span className="font-display text-sm tracking-tight">Parikshan</span>
        </Link>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Log in</CardTitle>
            <CardDescription>Welcome back — pick up where you left off.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="secondary"
              className="mb-4 w-full gap-2"
              onClick={handleDemoLogin}
              disabled={submitting || demoLoading}
            >
              {demoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Try the live demo
            </Button>
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Spins up a fresh account with a random email &amp; password — no signup needed.
            </p>
            <div className="mb-4 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or log in</span>
              <Separator className="flex-1" />
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={submitting}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full" type="button">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
