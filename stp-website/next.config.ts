import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  outputFileTracingIncludes: {
    "/api/lab/photo/**": ["./data/lab/photos/**/*"],
    "/api/reports/daily": ["./templates/report/**/*", "./data/lab/photos/**/*"],
    "/api/lab/export/**": ["./templates/lab/**/*", "./templates/report/**/*", "./data/lab/photos/**/*"],
  },
};

export default nextConfig;
