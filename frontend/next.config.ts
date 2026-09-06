import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // The chat preview proxy (space-z.ai gateway) redirects /dashboard → /dashboard/
  // (adds a trailing slash). Next.js by default redirects /dashboard/ → /dashboard
  // (removes it), which creates an infinite redirect loop behind that proxy.
  // Serving both forms without redirecting breaks the loop.
  skipTrailingSlashRedirect: true,
  // Proxy /api/* requests to the NestJS backend on port 3001.
  // This avoids CORS issues and keeps API calls same-origin.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
