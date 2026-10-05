import type { NextConfig } from "next";

// The UI kit is a git submodule consumed from source; tsconfig "paths" map @river-apps/* to it.
const kit = "./vendor/river-apps-ui-kit/packages";

/**
 * App Hosting injects FIREBASE_WEBAPP_CONFIG at build for the linked web app.
 * Explicit NEXT_PUBLIC_FIREBASE_* (e.g. .env.local) win.
 */
function webConfigEnv(): Record<string, string> {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};
  try {
    const c = JSON.parse(raw) as Record<string, string>;
    const pick = (key: string, value?: string) => (process.env[key] ? {} : value ? { [key]: value } : {});
    return {
      ...pick("NEXT_PUBLIC_FIREBASE_API_KEY", c.apiKey),
      ...pick("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", c.authDomain),
      ...pick("NEXT_PUBLIC_FIREBASE_PROJECT_ID", c.projectId),
      ...pick("NEXT_PUBLIC_FIREBASE_APP_ID", c.appId),
      ...pick("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", c.messagingSenderId),
    };
  } catch {
    return {};
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  env: webConfigEnv(),
  serverExternalPackages: ["firebase-admin", "@google-cloud/firestore", "google-gax"],
  turbopack: {
    resolveAlias: {
      "@river-apps/ui": `${kit}/ui/src/index.ts`,
      "@river-apps/icons": `${kit}/icons/src/index.ts`,
      "@river-apps/tokens/fonts.css": `${kit}/tokens/dist/fonts.css`,
      "@river-apps/tokens/theme.css": `${kit}/tokens/dist/theme.css`,
    },
  },
};
export default nextConfig;
