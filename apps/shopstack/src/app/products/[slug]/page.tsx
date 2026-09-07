"use client";

import { use } from "react";
import { notFound } from "next/navigation";

import { PRODUCTS, money, useStore } from "../../store";

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { add } = useStore();
  const product = PRODUCTS.find((p) => p.slug === slug);

  // notFound() rather than a paragraph. Returning JSX here answered 200 OK for
  // a product that does not exist: the page said "not found" while the status
  // line said the request succeeded, so a crawler indexed it, a monitor saw a
  // healthy response, and an API client had nothing to branch on.
  if (!product) notFound();

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
