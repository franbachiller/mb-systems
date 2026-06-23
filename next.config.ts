import type { NextConfig } from "next";

const isPagesShowcase = process.env.PAGES_SHOWCASE === "true";
const pagesBasePath = "/mb-systems";

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(isPagesShowcase
    ? {
        assetPrefix: pagesBasePath,
        basePath: pagesBasePath,
      }
    : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
