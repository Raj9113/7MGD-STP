import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets phones/tablets on the local network load the dev server's scripts
  // (otherwise the page renders but never hydrates, so buttons do nothing).
  allowedDevOrigins: ["192.168.*.*"],
  // Lab entry form: two compressed photos (< 2 MB each) travel with the report; Vercel itself caps requests at 4.5 MB.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  // The lab photo route reads these files at runtime; make sure they are bundled with it on Vercel.
  outputFileTracingIncludes: {
    "/api/lab/photo/**": ["./data/lab/photos/**/*"],
    // Excel / Word downloads are filled from templates cut from the lab team's own files (+ the photos for Word)
    // Daily plant report PDF: logos + lab photos
    "/api/reports/daily-pdf": ["./templates/report/**/*", "./data/lab/photos/**/*"],
    "/api/lab/export/**": ["./templates/lab/**/*", "./data/lab/photos/**/*"],
  },
};

export default nextConfig;
