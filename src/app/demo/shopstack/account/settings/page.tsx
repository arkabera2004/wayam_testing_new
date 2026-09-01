"use client";

import { useState } from "react";

import { KNOWN_EMAIL } from "../../store";

export default function AccountSettingsPage() {
  const [email, setEmail] = useState(KNOWN_EMAIL);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <h1 className="text-2xl font-semibold">Account settings</h1>

      {saved && (
        <p role="status" data-testid="account-saved" className="mt-4 text-green-700">
          Your email has been updated.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="mt-6 flex max-w-sm flex-col gap-3"
      >
        <label className="flex flex-col gap-1">
          Email
          <input
            aria-label="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSaved(false);
            }}
            className="border border-neutral-300 px-2 py-1"
          />
        </label>
        <button type="submit" className="border border-neutral-900 px-3 py-1">
          Save changes
        </button>
      </form>
    </>
  );
}
