import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Seed scripts only: like vitest.config.ts, but Firebase Admin comes from scripts/admin-token.ts.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\/firebase\/admin$/, replacement: r("./admin-token.ts") },
      { find: /^@\//, replacement: `${r("../src")}/` },
      { find: "server-only", replacement: r("../tests/stubs/server-only.ts") },
    ],
  },
});
