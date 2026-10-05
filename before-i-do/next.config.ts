import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the bundled 60-day plan is read at runtime on first launch
  outputFileTracingIncludes: {
    "/welcome": ["./data/*.xlsx"],
    "/settings": ["./data/*.xlsx"],
  },
  serverExternalPackages: ["sharp", "playwright-core"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
