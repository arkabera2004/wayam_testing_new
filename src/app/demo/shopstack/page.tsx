"use client";

import Link from "next/link";

import { PRODUCTS, money, useStore } from "./store";

export default function ProductListPage() {
  const { add } = useStore();
  return (
    <>
      <h1 className="text-2xl font-semibold">Products</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {PRODUCTS.map((p) => (
          <li key={p.slug} className="flex items-center gap-3 border border-neutral-200 p-3">
            <Link href={`/demo/shopstack/products/${p.slug}`} className="flex-1 underline">
              {p.name}
            </Link>
            <span>{money(p.price)}</span>
            <button
              type="button"
              onClick={() => add(p.slug)}
              className="border border-neutral-900 px-3 py-1"
            >
              Add to cart
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
