import type { NextConfig } from "next";

// The UI kit is a git submodule consumed from source; tsconfig "paths" map @river-apps/* to it.
const kit = "./vendor/river-apps-ui-kit/packages";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
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
