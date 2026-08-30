import { Skeleton } from "@/components/ui/menu";

/**
 * Shown while an authenticated route streams in. Deliberately mirrors the
 * shape of a typical page (header, stat strip, table) so navigation reads as
 * the layout filling in rather than the screen blanking.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-muted bg-container rounded-xl border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-24" />
            <Skeleton className="mt-4 h-6 w-full" />
          </div>
        ))}
      </div>

      <div className="border-muted bg-container rounded-xl border">
        <div className="border-muted border-b px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
