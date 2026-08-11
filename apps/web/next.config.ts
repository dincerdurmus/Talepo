import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Include monorepo data/ JSON in production traces. Do not set
  // turbopack.root to the repo root — that breaks apps/web node_modules
  // resolution (lucide-react MODULE_NOT_FOUND in `next dev`).
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
