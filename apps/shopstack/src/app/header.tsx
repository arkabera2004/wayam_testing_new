"use client";

import Link from "next/link";

import { useStore } from "./store";

export function Header() {
  const { count } = useStore();
  return (
    <header className="border-b border-neutral-200">
      <nav className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3 text-sm">
        <Link href="/" className="font-semibold">
          ShopStack
        </Link>
        <Link href="/search">Search</Link>
        <Link href="/login">Sign in</Link>
        <Link href="/account/settings">Account</Link>
        <Link href="/cart" className="ml-auto">
          Cart <span data-testid="cart-badge">{count}</span>
        </Link>
      </nav>
    </header>
  );
}
