import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/kipdok",
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
