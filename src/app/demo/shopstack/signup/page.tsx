"use client";

import { useState } from "react";

import { KNOWN_EMAIL } from "../store";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() === KNOWN_EMAIL) {
      setError("An account with that email already exists.");
      setCreated(false);
      return;
    }
    setError("");
    setCreated(true);
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
