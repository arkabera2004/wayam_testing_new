"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { Button, Card } from "@/components/ui";

/**
 * Segment error boundary.
 *
 * Without one, a failed query rendered the framework's bare "Application
 * error" on a black page with only a digest - which looks like the app broke
 * for good, when the usual cause is a moment where the database was
 * unreachable. This says what happened and offers the one thing that helps.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Segment error:", error);
  }, [error]);

  // Connection failures are worth naming, because the fix is just to try again.
  const isConnection = /fetch failed|ENOTFOUND|ECONNREFUSED|timeout|NeonDbError|Failed query/i.test(
    `${error.message} ${error.digest ?? ""}`,
  );

  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <Card className="max-w-lg">
        <h1 className="text-heading-md text-primary">
          {isConnection ? "Could not reach the database" : "Something went wrong"}
        </h1>
        <p className="text-body-md text-tertiary mt-2">
          {isConnection
            ? "The page needs data and the database did not answer. This is usually a brief network problem rather than anything you did."
            : "This page failed while rendering. The details are in the server log."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" icon={RotateCcw} onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign("/projects")}>
            Back to projects
          </Button>
        </div>

        {error.digest && (
          <p className="text-caption text-quaternary mt-4">
            Reference {error.digest} - quote this when looking in the server log.
          </p>
        )}
      </Card>
    </div>
  );
}
