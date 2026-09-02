import { cn } from "./index";

/**
 * A miniature of a discovered page.
 *
 * The crawler has no real screenshots to show yet, so every card used to draw
 * the same three grey bars - twelve identical tiles that told you nothing. A
 * thumbnail earns its space only if it distinguishes one page from another, so
 * the layout is chosen from the page's role: a listing looks like a grid, a
 * checkout looks like a form beside a summary, an auth page looks like a narrow
 * centred card.
 *
 * Everything is drawn from semantic surface tokens, so it follows the theme and
 * costs no network requests.
 */
type Archetype =
  | "home"
  | "listing"
  | "detail"
  | "cart"
  | "checkout"
  | "auth"
  | "account"
  | "search"
  | "article";

/** Longest-match first: /account/settings must beat /account. */
const RULES: [RegExp, Archetype][] = [
  [/^\/$/, "home"],
  [/^\/products\/.+/, "detail"],
  [/^\/products$/, "listing"],
  [/^\/cart/, "cart"],
  [/^\/checkout/, "checkout"],
  [/^\/(login|signup|register|sign-in)/, "auth"],
  [/^\/account/, "account"],
  [/^\/search/, "search"],
];

export function archetypeFor(path: string): Archetype {
  return RULES.find(([re]) => re.test(path))?.[1] ?? "article";
}

/** Shorthand builders so each layout below stays readable. */
const Bar = ({ w, dim = 1 }: { w: string; dim?: number }) => (
  <div className="bg-raised-2 h-1 rounded-full" style={{ width: w, opacity: dim }} />
);
const Block = ({ className }: { className?: string }) => (
  <div className={cn("bg-raised-2 rounded", className)} />
);

function Body({ kind }: { kind: Archetype }) {
  switch (kind) {
    case "home":
      return (
        <div className="flex h-full flex-col gap-1.5">
          <Block className="h-1/3 w-full opacity-70" />
          <div className="flex flex-col items-center gap-1 py-0.5">
            <Bar w="55%" />
            <Bar w="35%" dim={0.5} />
          </div>
          <div className="mt-auto grid grid-cols-3 gap-1">
            <Block className="h-4" />
            <Block className="h-4 opacity-70" />
            <Block className="h-4 opacity-50" />
          </div>
        </div>
      );

    case "listing":
      return (
        <div className="flex h-full flex-col gap-1.5">
          <div className="flex gap-1">
            <Block className="h-2 w-10 opacity-70" />
            <Block className="ml-auto h-2 w-6 opacity-40" />
          </div>
          <div className="grid flex-1 grid-cols-4 grid-rows-2 gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Block key={i} className="h-full" />
            ))}
          </div>
        </div>
      );

    case "detail":
      return (
        <div className="flex h-full gap-2">
          <Block className="h-full w-1/2 opacity-70" />
          <div className="flex flex-1 flex-col gap-1 pt-1">
            <Bar w="80%" />
            <Bar w="45%" dim={0.5} />
            <Bar w="65%" dim={0.4} />
            <Block className="mt-auto h-4 w-full" />
          </div>
        </div>
      );

    case "cart":
      return (
        <div className="flex h-full gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Block className="h-5 w-5 shrink-0" />
                <div className="flex flex-1 flex-col gap-1">
                  <Bar w="70%" dim={0.7} />
                  <Bar w="40%" dim={0.4} />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-raised-2 flex w-1/4 flex-col gap-1 rounded p-1 opacity-70">
            <Bar w="100%" dim={0.6} />
            <Bar w="70%" dim={0.4} />
          </div>
        </div>
      );

    case "checkout":
      return (
        <div className="flex h-full gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Block key={i} className="h-3 w-full opacity-60" />
            ))}
            <Block className="mt-auto h-4 w-2/3" />
          </div>
          <div className="bg-raised-2 w-1/3 rounded opacity-60" />
        </div>
      );

    case "auth":
      return (
        <div className="grid h-full place-items-center">
          <div className="border-muted flex w-3/5 flex-col gap-1.5 rounded border p-2">
            <Bar w="50%" />
            <Block className="h-3 w-full opacity-60" />
            <Block className="h-3 w-full opacity-60" />
            <Block className="h-3 w-full" />
          </div>
        </div>
      );

    case "account":
      return (
        <div className="flex h-full gap-2">
          <div className="flex w-1/4 flex-col gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bar key={i} w="100%" dim={i === 0 ? 1 : 0.4} />
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Block key={i} className="h-3 w-full opacity-50" />
            ))}
          </div>
        </div>
      );

    case "search":
      return (
        <div className="flex h-full flex-col gap-1.5">
          <Block className="h-3 w-full opacity-70" />
          <div className="flex flex-1 flex-col gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <Bar w={`${75 - i * 10}%`} dim={0.7} />
                <Bar w={`${55 - i * 8}%`} dim={0.3} />
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className="flex h-full flex-col gap-1.5">
          <Bar w="60%" />
          <div className="flex flex-1 flex-col gap-1">
            {["100%", "92%", "96%", "70%"].map((w, i) => (
              <Bar key={i} w={w} dim={0.4} />
            ))}
          </div>
        </div>
      );
  }
}

export function PageThumbnail({
  path,
  gated = false,
  className,
}: {
  path: string;
  gated?: boolean;
  className?: string;
}) {
  const kind = archetypeFor(path);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-raised border-muted relative flex aspect-video flex-col overflow-hidden rounded-lg border",
        className,
      )}
    >
      {/* Browser chrome - reads as a captured page rather than a loading skeleton. */}
      <div className="border-muted flex shrink-0 items-center gap-1 border-b px-1.5 py-1">
        <span className="bg-raised-2 h-1 w-1 rounded-full" />
        <span className="bg-raised-2 h-1 w-1 rounded-full" />
        <span className="bg-raised-2 h-1 w-1 rounded-full" />
        <span className="bg-raised-2 ml-1 h-1.5 flex-1 rounded-full opacity-60" />
      </div>

      <div className="min-h-0 flex-1 p-2">
        <Body kind={kind} />
      </div>

      {/* Auth-gated pages get a scrim, mirroring what the crawler actually hit. */}
      {gated && <div className="bg-page/35 pointer-events-none absolute inset-0" />}
    </div>
  );
}
