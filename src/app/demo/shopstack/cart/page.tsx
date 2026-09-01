"use client";

import Link from "next/link";

import { PRODUCTS, money, useStore } from "../store";

export default function CartPage() {
  const { lines, setQty, remove, total } = useStore();

  if (lines.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Cart</h1>
        <p className="mt-4" data-testid="cart-empty">
          Your cart is empty.
        </p>
        <Link href="/demo/shopstack" className="mt-2 inline-block underline">
          Continue shopping
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Cart</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {lines.map((l) => {
          const p = PRODUCTS.find((x) => x.slug === l.slug);
          if (!p) return null;
          return (
            <li key={l.slug} className="flex items-center gap-3 border border-neutral-200 p-3">
              <span className="flex-1">{p.name}</span>
              <label className="flex items-center gap-2">
                Quantity
                <input
                  type="number"
                  min={0}
                  aria-label={`Quantity for ${p.name}`}
                  value={l.qty}
                  onChange={(e) => setQty(l.slug, Number(e.target.value))}
                  className="w-16 border border-neutral-300 px-2 py-1"
                />
              </label>
              <span data-testid={`line-total-${l.slug}`}>{money(p.price * l.qty)}</span>
              <button type="button" onClick={() => remove(l.slug)} className="underline">
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4">
        Cart total <span data-testid="cart-total">{money(total)}</span>
      </p>
      <Link href="/demo/shopstack/checkout" className="mt-4 inline-block border border-neutral-900 px-3 py-1">
        Checkout
      </Link>
    </>
  );
}
