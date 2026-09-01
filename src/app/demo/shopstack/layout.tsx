import type { ReactNode } from "react";

import { StoreProvider } from "./store";
import { Header } from "./header";

export const metadata = { title: "ShopStack" };

export default function ShopStackLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-white text-neutral-900">
        <Header />
        <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      </div>
    </StoreProvider>
  );
}
