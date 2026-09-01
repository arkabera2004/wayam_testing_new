"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { money, useStore } from "../store";

/** Anything expiring before this is treated as expired. */
const TODAY = new Date("2026-09-01");

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, total, hydrated } = useStore();
  const [expiry, setExpiry] = useState("");
  const [card, setCard] = useState("");
  const [declined, setDeclined] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Checkout is not reachable with nothing to buy — but only once the stored
  // cart has been read back. Redirecting on the pre-hydration state bounced
  // shoppers with a full cart straight to the empty-cart page.
  useEffect(() => {
    if (hydrated && lines.length === 0 && !orderNumber) router.replace("/demo/shopstack/cart");
  }, [hydrated, lines.length, orderNumber, router]);

  if (!hydrated) return <p>Loading checkout…</p>;

  if (orderNumber) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Order confirmed</h1>
        <p className="mt-4">
          Order number <span data-testid="order-number">{orderNumber}</span>
        </p>
      </>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const [mm, yy] = expiry.split("/").map((s) => Number(s.trim()));
    const expires = new Date(2000 + (yy || 0), (mm || 1) - 1, 1);
    if (!mm || !yy || expires < TODAY) {
      setDeclined(true);
      return;
    }
    setDeclined(false);
    setOrderNumber("SS-" + String(10_000 + Math.round(total * 100)).slice(0, 5));
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <p className="mt-2">Paying {money(total)}</p>

      {declined && (
        <p role="alert" data-testid="decline-message" className="mt-4 text-red-700">
          Your card was declined because it has expired. No order was created.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1">
          Card number
          <input
            aria-label="Card number"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Expiry
          <input
            aria-label="Expiry"
            placeholder="MM/YY"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <button type="submit" className="border border-neutral-900 px-3 py-1">
          Place order
        </button>
      </form>
    </>
  );
}
