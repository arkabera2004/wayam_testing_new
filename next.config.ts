import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin tracing to this project; a lockfile higher up the tree makes Next
  // guess the wrong workspace root otherwise.
  outputFileTracingRoot: path.join(__dirname),

  // Next's floating dev badge sits in the bottom-left corner, on top of the
  // sidebar's own controls. It only appears in development - which is exactly
  // where this gets demonstrated, and a stray "N" over the account button
  // reads as part of the product.
  devIndicators: false,
};

export default nextConfig;
