import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// The UI kit is a git submodule consumed from source; tsconfig "paths" map @river-apps/* to it.
const kit = "./vendor/river-apps-ui-kit/packages";
// River Maps (MapLibre + PMTiles) is a git submodule consumed from source too.
const maps = "./vendor/river-maps/packages/river-map/src";

// App version shown in Settings and footers; same source /api/version reports.
const APP_VERSION: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// One id per build: inlined into client and server so /api/version can tell open tabs a new deploy is live.
const BUILD_ID = process.env.BUILD_ID_OVERRIDE || Date.now().toString(36);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // With `revalidate = 60` in the root layout, HTML is sent as "s-maxage=60, stale-while-revalidate=60":
  // a CDN can serve a page at most ~2 minutes old (default would be a year).
  expireTime: 120,
  agentRules: false,
  devIndicators: false,
  // AI Companion switch (see src/lib/companion-flag.ts): on only where COMPANION_ENABLED=1.
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_COMPANION_ENABLED: process.env.COMPANION_ENABLED === "1" ? "1" : "0",
    // Plan limits switch (src/lib/entitlements.ts): off unless PLAN_LIMITS_ENABLED=1.
    NEXT_PUBLIC_PLAN_LIMITS_ENABLED: process.env.PLAN_LIMITS_ENABLED === "1" ? "1" : "0",
  },
  // Same-origin Firebase Auth handler (Safari blocks cross-site redirect storage). Used when
  // NEXT_PUBLIC_AUTH_SAME_ORIGIN=1 and the host's /__/auth/handler is an authorized OAuth redirect URI.
  // Baseline security headers on every response (river-ai-rules 03-build/security-and-vulnerabilities).
  // No CSP yet: Firebase Auth popups/redirects, reCAPTCHA and map tiles need an allowlist that is tested
  // first in Report-Only mode (see docs/compliance open items).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Camera: QR scanner. Geolocation: map pin. Nothing else is used.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()" },
        ],
      },
    ];
  },
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
      { source: "/messages", destination: "/moments", permanent: false },
      { source: "/community", destination: "/moments", permanent: true },
      { source: "/community/:path*", destination: "/moments/:path*", permanent: true },
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
