import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// v1.0.24 guardrails (Boyet audit): fail the build when code reintroduces the class of bug that undercounted the owner.
vi.mock("server-only", () => ({}));
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = (dir: string, re: RegExp) => walk(dir).filter((f) => re.test(f));

describe("static count guardrails", () => {
  it("screens never compute haircut/sales/split counts from a capped live list alone", () => {
    const bad: string[] = [];
    for (const f of src("src/features", /\.tsx?$/)) {
      const s = readFileSync(f, "utf8");
      if (!/\b(todayFigures|countToday|doneOnDay|dailySeries|barberStats|profitWeek)\(/.test(s)) continue;
      if (/useSalesRows|mergeLiveRows|useHistoryRows|counts-ok:/.test(s)) continue;
      bad.push(f);
    }
    expect(bad, "Count from the whole-day server read (useSalesRows + mergeLiveRows), or annotate `// counts-ok: why`").toEqual([]);
  });

  it("server bookings reads never use a raw .limit() (use cappedGet so a hit cap is logged and flagged)", () => {
    const bad: string[] = [];
    for (const f of [...src("src/lib/server", /\.ts$/), ...src("src/app/api", /\.ts$/)]) {
      if (f.endsWith("capped-read.ts")) continue;
      const s = readFileSync(f, "utf8");
      if (!s.includes('"bookings"')) continue;
      s.split("\n").forEach((l, i) => { if (/\.limit\(/.test(l) && !/\.limit\(1\)/.test(l) && !/cap-ok:/.test(l)) bad.push(`${f}:${i + 1}`); });
    }
    expect(bad, "Use cappedGet(q, cap, label, kind) or annotate `// cap-ok: why`").toEqual([]);
  });
});

describe("cappedGet never truncates silently", () => {
  const q = (n: number) => ({ limit: (k: number) => ({ get: async () => ({ docs: Array.from({ length: Math.min(n, k) }, (_, i) => i) }) }) });
  it("under the cap: all rows, not truncated, no log", async () => {
    const { cappedGet, capHits } = await import("@/lib/server/capped-read");
    capHits.length = 0; const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await cappedGet(q(10), 10, "t");
    expect(r).toEqual({ docs: Array.from({ length: 10 }, (_, i) => i), truncated: false });
    expect(err).not.toHaveBeenCalled(); expect(capHits).toEqual([]); err.mockRestore();
  });
  it("over the cap on a total read: flagged + [cap-hit] error", async () => {
    const { cappedGet, capHits } = await import("@/lib/server/capped-read");
    capHits.length = 0; const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await cappedGet(q(50), 10, "totals");
    expect(r.truncated).toBe(true); expect(r.docs).toHaveLength(10);
    expect(err.mock.calls[0]?.[0]).toMatch(/\[cap-hit\] totals/); expect(capHits[0]).toMatchObject({ label: "totals", kind: "total" }); err.mockRestore();
  });
  it("over the cap on a window read: flagged, recorded, not an error", async () => {
    const { cappedGet, capHits } = await import("@/lib/server/capped-read");
    capHits.length = 0; const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await cappedGet(q(50), 10, "live", "window");
    expect(r.truncated).toBe(true); expect(err).not.toHaveBeenCalled(); expect(capHits[0]?.kind).toBe("window"); err.mockRestore();
  });
});
