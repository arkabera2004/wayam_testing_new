import type { ReactNode } from "react";

import "./globals.css";
import { StoreProvider } from "./store";
import { Header } from "./header";

export const metadata = { title: "ShopStack" };

/**
 * Root layout of the storefront, now that it is its own application rather
 * than a route inside Parikshan.
 */
export default function ShopStackLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <div className="min-h-screen bg-white text-neutral-900">
            <Header />
            <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
