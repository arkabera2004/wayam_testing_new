import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Michroma } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { NotificationsProvider } from "@/context/notifications-context";
import { ThemeProvider } from "@/context/theme-context";
import { THEME_STORAGE_KEY, themeFromCookie } from "@/lib/theme";

import "./globals.css";

/** Functional product UI typeface — the interface default. */
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap",
});

/** Code / test-source typeface. Pairs metrically with Geist. */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

/** Display / branded / telemetry typeface. Single weight by design. */
const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-michroma",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parikshan",
  description:
    "Parikshan, a Wayam AI product. AI that explores your app, proposes tests you approve, and keeps the suite green.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = themeFromCookie(cookieStore.get(THEME_STORAGE_KEY)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${michroma.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ThemeProvider initialTheme={theme}>
          <ToastProvider>
            <NotificationsProvider>{children}</NotificationsProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
