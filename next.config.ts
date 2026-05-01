import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin "output: standalone" — compatible con Cloudflare Pages + @opennextjs/cloudflare
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
