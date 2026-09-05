"use client";

import { useState } from "react";

import { KNOWN_EMAIL, KNOWN_PASSWORD, LOCKOUT_AFTER, useStore } from "../store";

export default function LoginPage() {
  const { signIn, failedAttempts, recordFailure, locked, signedIn } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) {
      setError("This account is locked. Too many failed attempts.");
      return;
    }
    if (email === KNOWN_EMAIL && password === KNOWN_PASSWORD) {
      setError("");
      signIn();
      return;
    }
    recordFailure();
    // The count in state is one behind until the next render.
    setError(
      failedAttempts + 1 >= LOCKOUT_AFTER
        ? "This account is locked. Too many failed attempts."
        : "Incorrect email or password.",
    );
  }

  if (signedIn) return <p data-testid="signed-in">Signed in as {KNOWN_EMAIL}.</p>;

  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>

      {error && (
        <p role="alert" data-testid="login-error" className="mt-4 text-red-700">
          {error}
        </p>
      )}

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
        <label className="flex flex-col gap-1">
          Password
          <input
            aria-label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <button type="submit" className="border border-neutral-900 px-3 py-1">
          Sign in
        </button>
      </form>
    </>
  );
}
