import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-card";
import { clerkAppearance } from "@/components/clerk-appearance";

export default function LoginPage() {
  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle="Sign in to your Parikshan workspace."
    >
      <SignIn
        appearance={clerkAppearance}
        routing="hash"
        signUpUrl="/signup"
        fallbackRedirectUrl="/projects"
      />
    </AuthShell>
  );
}
