import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const origin = process.env.LYRA_API_ORIGIN ?? "http://127.0.0.1:4020";
    return [{ source: "/api/:path*", destination: `${origin}/:path*` }];
  },
};

export default nextConfig;
