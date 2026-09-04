"use client";

import { useState } from "react";



export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  // Goes through the server so sign-up has an API layer underneath it. When
  // that call fails, the error element never renders - which from the UI is
  // indistinguishable from the element having been renamed.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(false);
    try {
      const res = await fetch("/demo/shopstack/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(data.error);
        return;
      }
      if (!res.ok) return;
      setCreated(true);
    } catch {
      /* Nothing rendered: the page cannot say what it was not told. */
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Create an account</h1>

      {error && (
        <p role="alert" data-testid="signup-error" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {created && <p data-testid="signup-success" className="mt-4">Account created.</p>}

      <form onSubmit={submit} className="mt-6 flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1">
          Email
          <input
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <button type="submit" className="border border-neutral-900 px-3 py-1">
          Create account
        </button>
      </form>
    </>
  );
}
