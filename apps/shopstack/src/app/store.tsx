"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * ShopStack - a deliberately small storefront that exists to be tested.
 *
 * Parikshan's demo project describes cart, checkout, auth and search
 * behaviour, but pointed at shopstack.demo, which does not resolve, so none of
 * its specs could ever run. This is that application: enough real behaviour
 * for the scenarios to pass or fail honestly, held in memory so runs are
 * deterministic and need no database.
 */
export type Product = { slug: string; name: string; price: number };

export const PRODUCTS: Product[] = [
  { slug: "wireless-mouse", name: "Wireless Mouse", price: 24.0 },
  { slug: "mechanical-keyboard", name: "Mechanical Keyboard", price: 89.0 },
  { slug: "usb-c-hub", name: "USB-C Hub", price: 42.5 },
];

/** The account the fixtures assume already exists. */
export const KNOWN_EMAIL = "demo@shopstack.demo";
export const KNOWN_PASSWORD = "correct-horse";
export const LOCKOUT_AFTER = 5;

export type Line = { slug: string; qty: number };

type StoreValue = {
  lines: Line[];
  add: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  count: number;
  total: number;
  signedIn: boolean;
  signIn: () => void;
  failedAttempts: number;
  recordFailure: () => void;
  locked: boolean;
  /** False until the stored cart has been read back. */
  hydrated: boolean;
};

const StoreContext = createContext<StoreValue | null>(null);

const CART_KEY = "shopstack.cart";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  /**
   * The cart has to survive a page load.
   *
   * Held only in React state it was emptied by every navigation - add an item,
   * open /cart, and the cart was empty again. Reading happens after mount
   * rather than during render so the server and client agree on the first
   * paint; `hydrated` then gates writes so that first empty render cannot
   * overwrite what is already stored.
   */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (raw) setLines(JSON.parse(raw) as Line[]);
    } catch {
      // A malformed or unavailable store just means starting empty.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      // Storage being full or blocked must not break the page.
    }
  }, [lines, hydrated]);

  const value = useMemo<StoreValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const total = lines.reduce(
      (n, l) => n + l.qty * (PRODUCTS.find((p) => p.slug === l.slug)?.price ?? 0),
      0,
    );
    return {
      lines,
      count,
      total,
      add: (slug) =>
        setLines((prev) =>
          prev.some((l) => l.slug === slug)
            ? prev.map((l) => (l.slug === slug ? { ...l, qty: l.qty + 1 } : l))
            : [...prev, { slug, qty: 1 }],
        ),
      setQty: (slug, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((l) => l.slug !== slug)
            : prev.map((l) => (l.slug === slug ? { ...l, qty } : l)),
        ),
      remove: (slug) => setLines((prev) => prev.filter((l) => l.slug !== slug)),
      signedIn,
      signIn: () => setSignedIn(true),
      failedAttempts,
      recordFailure: () => setFailedAttempts((n) => n + 1),
      locked: failedAttempts >= LOCKOUT_AFTER,
      hydrated,
    };
  }, [lines, signedIn, failedAttempts, hydrated]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export const money = (n: number) => "$" + n.toFixed(2);
