import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin tracing to this project; a lockfile higher up the tree makes Next
  // guess the wrong workspace root otherwise.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
