import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets phones/tablets on the local network load the dev server's scripts
  // (otherwise the page renders but never hydrates, so buttons do nothing).
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
