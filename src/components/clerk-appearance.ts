import type { Appearance } from "@clerk/types";

/**
 * Maps Clerk's widget onto Parikshan's design system.
 *
 * Clerk ships its own palette and type scale, which would otherwise land a
 * second visual language on the sign-in screens. Everything here points at the
 * semantic tokens, so the widget follows the theme toggle like the rest of the
 * app rather than needing a light and a dark copy.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorBackground: "var(--surface-container)",
    colorPrimary: "var(--action-primary-default)",
    colorText: "var(--text-primary)",
    colorTextSecondary: "var(--text-tertiary)",
    colorInputBackground: "var(--surface-raised)",
    colorInputText: "var(--text-primary)",
    colorDanger: "var(--feedback-error-icon)",
    colorSuccess: "var(--feedback-success-icon)",
    colorWarning: "var(--feedback-warning-icon)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans)",
  },
  // Clerk's own rules out-specify a bare utility class, so the overrides that
  // must win carry Tailwind's important modifier. Without it the widget keeps
  // its default card, header and palette and ignores everything below.
  elements: {
    rootBox: "!w-full",
    cardBox: "!w-full !max-w-none !shadow-none !border-0",
    card: "!bg-transparent !shadow-none !border-0 !p-0 !w-full",
    // The shell above already says "Welcome back"; Clerk's header would repeat
    // it and print the Marketplace resource name as the product name.
    header: "!hidden",
    footer: "!bg-transparent !border-0",
    formButtonPrimary:
      "bg-action-primary text-on-color hover:bg-action-primary-hover text-label-md h-9 normal-case",
    socialButtonsBlockButton:
      "border-muted bg-action-secondary text-primary hover:bg-action-secondary-hover h-9",
    formFieldInput: "border-muted bg-raised text-primary h-9",
    formFieldLabel: "text-label-md text-secondary",
    dividerLine: "bg-muted",
    dividerText: "text-caption text-quaternary",
    footerActionLink: "text-primary hover:text-primary underline underline-offset-4",
    identityPreviewText: "text-secondary",
    formResendCodeLink: "text-secondary",
  },
};
