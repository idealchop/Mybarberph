import { describe, expect, it } from "vitest";
import { hideInstall, installScope, installedKey, markInstalled, scopeFromPath, wasInstalled } from "@/lib/pwa";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("install card hide logic", () => {
  it("hides when standalone or remembered, shows otherwise", () => {
    expect(hideInstall({ standalone: false, remembered: false })).toBe(false);
    expect(hideInstall({ standalone: true, remembered: false })).toBe(true);
    expect(hideInstall({ standalone: false, remembered: true })).toBe(true);
  });
  it("scopes the owner app and each barber link separately", () => {
    expect(installScope()).toBe("owner");
    expect(installScope("abc123")).toBe("b:abc123");
    expect(scopeFromPath("/b/abc123")).toBe("b:abc123");
    expect(scopeFromPath("/b/abc123/anything")).toBe("b:abc123");
    expect(scopeFromPath("/home")).toBe("owner");
    expect(scopeFromPath("/settings/install")).toBe("owner");
    expect(installedKey("b:x")).toBe("barbers.pwa-installed.b:x");
  });
  it("remembers per scope", () => {
    const kv = mem();
    expect(wasInstalled("b:t1", kv)).toBe(false);
    markInstalled("b:t1", kv);
    expect(wasInstalled("b:t1", kv)).toBe(true);
    expect(wasInstalled("b:t2", kv)).toBe(false);
    expect(wasInstalled("owner", kv)).toBe(false);
  });
  it("survives broken storage", () => {
    const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(() => markInstalled("owner", bad)).not.toThrow();
    expect(wasInstalled("owner", bad)).toBe(false);
  });
});
