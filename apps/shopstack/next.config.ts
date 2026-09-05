import path from "node:path";

import type { NextConfig } from "next";

/**
 * The storefront under test, as its own application.
 *
 * It used to be a route inside Parikshan, which meant the harness and the thing
 * it was testing were the same process: a proposed source change could not be
 * built without restarting the process doing the verifying, so no honest
 * verdict was possible. Separating them is what makes rebuild-and-re-run real.
 *
 * The base path is kept so the specs written against /demo/shopstack keep
 * working unchanged - what moved is the process, not the URLs.
 */
const nextConfig: NextConfig = {
  basePath: "/demo/shopstack",
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
