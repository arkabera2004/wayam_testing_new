import { cn } from "@/components/ui";

/** Intrinsic aspect ratio of the supplied wordmark (2089 x 753). */
const WORDMARK_RATIO = 2089 / 753;

/**
 * Square brand mark. Used wherever there is no room for the full lockup:
 * the collapsed sidebar, the auth card, the favicon.
 *
 * The mark carries its own gradient background, so it reads on either theme
 * and needs no light/dark variant.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing for the image optimiser to do
    <img
      src="/brand/parikshan-mark.svg"
      alt="Parikshan"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[22%]", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Full lockup (mark + wordmark).
 *
 * Two files rather than one recoloured file, because that is how the brand
 * assets were supplied. Both are in the DOM and CSS picks one from the
 * [data-theme] attribute, so the correct variant is present in the very first
 * server-rendered paint. A JS-driven swap would flash the wrong one.
 */
export function Wordmark({ height = 24, className }: { height?: number; className?: string }) {
  const width = Math.round(height * WORDMARK_RATIO);
  const dims = { width, height };

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} style={dims}>
      {/* eslint-disable @next/next/no-img-element -- static SVG */}
      <img
        src="/brand/parikshan-wordmark-dark.svg"
        alt="Parikshan"
        {...dims}
        className="brand-on-dark"
        style={dims}
      />
      <img
        src="/brand/parikshan-wordmark-light.svg"
        alt="Parikshan"
        {...dims}
        className="brand-on-light"
        style={dims}
      />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
