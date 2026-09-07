import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets `next dev` serve its dev-only assets (HMR, etc.) to requests coming
  // from the phone testing over the LAN IP printed in the dev server's own
  // "Network:" line, not just localhost. Dev-only; irrelevant in production.
  allowedDevOrigins: ["192.168.2.16"],
};

export default nextConfig;
