import type { NextConfig } from "next";

// The UI kit is a git submodule consumed from source; tsconfig "paths" map @river-apps/* to it.
const kit = "./vendor/river-apps-ui-kit/packages";
// River Maps (MapLibre + PMTiles) is a git submodule consumed from source too.
const maps = "./vendor/river-maps/packages/river-map/src";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  // Same-origin Firebase Auth handler (Safari blocks cross-site redirect storage). Used when
  // NEXT_PUBLIC_AUTH_SAME_ORIGIN=1 and the host's /__/auth/handler is an authorized OAuth redirect URI.
  async rewrites() {
    return [{ source: "/__/auth/:path*", destination: "https://mybarberph.firebaseapp.com/__/auth/:path*" }];
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/home", permanent: false },
      { source: "/customers", destination: "/queue", permanent: false },
      { source: "/customers/:id", destination: "/queue", permanent: false },
      { source: "/barbers", destination: "/settings", permanent: false },
      { source: "/vouchers", destination: "/home", permanent: false },
      { source: "/messages", destination: "/community", permanent: false },
      { source: "/kiosk", destination: "/queue/new", permanent: false },
      { source: "/partner", destination: "/home", permanent: false },
      { source: "/partner/incoming", destination: "/queue?channel=online", permanent: false },
      { source: "/partner/history", destination: "/queue", permanent: false },
      { source: "/partner/scan", destination: "/queue", permanent: false },
      { source: "/partner/shop", destination: "/settings", permanent: false },
    ];
  },
  turbopack: {
    resolveAlias: {
      "@river-apps/ui": `${kit}/ui/src/index.ts`,
      "@river-apps/icons": `${kit}/icons/src/index.ts`,
      "@river-apps/tokens/fonts.css": `${kit}/tokens/dist/fonts.css`,
      "@river-apps/tokens/theme.css": `${kit}/tokens/dist/theme.css`,
      "@river/map": `${maps}/index.ts`,
    },
  },
};
export default nextConfig;
