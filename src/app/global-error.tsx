"use client";

/**
 * Last resort, for failures in the root layout itself. It cannot rely on the
 * app's providers or styles, so everything here is inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
          <div style={{ maxWidth: 460, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Parikshan could not start this page</h1>
            <p style={{ color: "#666", marginTop: 8, lineHeight: 1.5 }}>
              The application failed before it could render. This is usually a brief problem
              reaching the database.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 16, padding: "8px 16px", borderRadius: 8,
                border: "1px solid #ddd", background: "#111", color: "#fff", cursor: "pointer",
              }}
            >
              Try again
            </button>
            {error.digest && (
              <p style={{ color: "#999", fontSize: 12, marginTop: 16 }}>Reference {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
