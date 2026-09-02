import type { ReactNode } from "react";
import Link from "next/link";

import { Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui";

/**
 * Marketing shell: no app sidebar, and the only place in the product where
 * the page itself scrolls (the app shell scrolls its main region instead).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-page text-primary h-screen w-screen overflow-y-auto">
      <header className="border-muted bg-page/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link href="/" aria-label="Parikshan home" className="flex items-center">
            <Wordmark height={32} />
          </Link>

          <nav className="hidden flex-1 items-center gap-6 md:flex">
            <Link
              href="/pricing"
              className="text-label-md text-tertiary hover:text-primary transition-colors duration-[170ms]"
            >
              Pricing
            </Link>
            <a
              href="#how-it-works"
              className="text-label-md text-tertiary hover:text-primary transition-colors duration-[170ms]"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-label-md text-tertiary hover:text-primary transition-colors duration-[170ms]"
            >
              Features
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary">Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-muted border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Wordmark height={30} />
            <p className="text-body-sm text-tertiary mt-3 max-w-xs">
              From requirements to Playwright - before or after you ship. Traceable tests you own.
            </p>
            <p className="text-label-sm text-secondary mt-4">A Wayam AI product</p>
          </div>

          {[
            { title: "Product", links: ["Overview", "Self-healing", "Pricing", "Changelog"] },
            { title: "Docs", links: ["Quickstart", "Playwright output", "CI integration", "API"] },
            { title: "Company", links: ["About", "Careers", "Privacy", "Terms"] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-label-md text-primary">{col.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-body-sm text-tertiary hover:text-primary transition-colors duration-[170ms]"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-muted border-t">
          <p className="text-caption text-quaternary mx-auto max-w-6xl px-6 py-5">
            © 2026 Parikshan, a Wayam AI product. Playwright-native. SOC 2 roadmap.
          </p>
        </div>
      </footer>
    </div>
  );
}
