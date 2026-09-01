import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-card";
import { clerkAppearance } from "@/components/clerk-appearance";

export default function SignupPage() {
  return (
    <AuthShell
      mode="signup"
      title="Create your workspace"
      subtitle="Start generating tests from your application in minutes."
    >
      <SignUp
        appearance={clerkAppearance}
        routing="hash"
        signInUrl="/login"
        fallbackRedirectUrl="/onboarding"
      />
    </AuthShell>
  );
}
