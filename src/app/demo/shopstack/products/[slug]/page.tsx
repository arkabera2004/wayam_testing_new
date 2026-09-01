"use client";

import { use } from "react";

import { PRODUCTS, money, useStore } from "../../store";

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { add } = useStore();
  const product = PRODUCTS.find((p) => p.slug === slug);

  if (!product) return <p>Product not found.</p>;

  return (
    <>
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="mt-2">{money(product.price)}</p>
      <button
        type="button"
        onClick={() => add(product.slug)}
        className="mt-4 border border-neutral-900 px-3 py-1"
      >
        Add to cart
      </button>
    </>
  );
}
