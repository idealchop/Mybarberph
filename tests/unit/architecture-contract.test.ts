/**
 * River AI Rules 04-test/architecture-contract-testing: the FE/BE law, checked on the source tree.
 * - The browser never gets the Firestore/Storage SDK (no business writes from the client).
 * - The Admin SDK is only imported by server code (route handlers and server-only modules).
 * - Every server module is marked server-only, so a client import fails the build.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const src = files(join(root, "src")).map((p) => ({ path: relative(root, p), text: readFileSync(p, "utf8") }));
const isServer = (p: string) => p.startsWith("src/lib/server/") || p === "src/lib/firebase/admin.ts" || /^src\/app\/api\/.*route\.ts$/.test(p);

describe("Architecture contract (FE/BE law)", () => {
  it("TC-ARCH-NEG-01 no source file imports the Firestore or Storage client SDK", () => {
    const hits = src.filter((f) => /from ["']firebase\/(firestore|storage)["']/.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("TC-ARCH-NEG-02 the Admin SDK is imported only by server code", () => {
    const hits = src.filter((f) => /from ["']firebase-admin/.test(f.text) && !isServer(f.path)).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("TC-ARCH-HP-01 every server module is marked server-only", () => {
    const mods = src.filter((f) => f.path.startsWith("src/lib/server/") || f.path === "src/lib/firebase/admin.ts");
    expect(mods.length).toBeGreaterThan(5);
    expect(mods.filter((f) => !f.text.includes('import "server-only"')).map((f) => f.path)).toEqual([]);
  });

  it("TC-ARCH-NEG-03 client code never imports server modules", () => {
    const hits = src.filter((f) => !isServer(f.path) && !f.path.startsWith("src/lib/server/") && /from ["']@\/lib\/(server\/|firebase\/admin)/.test(f.text)).map((f) => f.path);
    expect(hits).toEqual([]);
  });
});
