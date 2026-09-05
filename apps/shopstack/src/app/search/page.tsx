"use client";

import { useState } from "react";

import { PRODUCTS, money } from "../store";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const results = submitted
    ? PRODUCTS.filter((p) => p.name.toLowerCase().includes(submitted.toLowerCase()))
    : PRODUCTS;

  return (
    <>
      <h1 className="text-2xl font-semibold">Search</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term);
        }}
        className="mt-6 flex max-w-sm gap-2"
      >
        <input
          aria-label="Search products"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="flex-1 border border-neutral-300 px-2 py-1"
        />
        <button type="submit" className="border border-neutral-900 px-3 py-1">
          Search
        </button>
      </form>

      {results.length === 0 ? (
        <div className="mt-6">
          <p data-testid="search-empty">No products match “{submitted}”.</p>
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setSubmitted("");
            }}
            className="mt-2 underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {results.map((p) => (
            <li key={p.slug}>
              {p.name} - {money(p.price)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
