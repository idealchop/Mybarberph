import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit + API contract tests (river-ai-rules 04-test/unit-testing). No network: Firebase Admin and
// Firestore are mocked per test, and "server-only" is stubbed so server modules load under Node.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    restoreMocks: true,
  },
});
