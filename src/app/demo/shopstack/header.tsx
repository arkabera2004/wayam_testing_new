"use client";

import Link from "next/link";

import { useStore } from "./store";

export function Header() {
  const { count } = useStore();
  return (
    <header className="border-b border-neutral-200">
      <nav className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3 text-sm">
        <Link href="/demo/shopstack" className="font-semibold">
          ShopStack
        </Link>
        <Link href="/demo/shopstack/search">Search</Link>
        <Link href="/demo/shopstack/login">Sign in</Link>
        <Link href="/demo/shopstack/account/settings">Account</Link>
        <Link href="/demo/shopstack/cart" className="ml-auto">
          Cart <span data-testid="cart-badge">{count}</span>
        </Link>
      </nav>
    </header>
  );
}
