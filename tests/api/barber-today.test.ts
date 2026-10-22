import { describe, expect, it } from "vitest";
import { barberRange, historyRange, manilaYmd } from "@/lib/barber-sales";


const at = (iso: string) => Date.parse(iso);
describe("My sales: today is the Manila day (resets at midnight PHT)", () => {
  it("23:59 PHT and 00:00 PHT are different days", () => {
    expect(manilaYmd(at("2026-10-22T15:59:59Z"))).toBe("2026-10-22"); // 23:59:59 PHT
    expect(manilaYmd(at("2026-10-22T16:00:00Z"))).toBe("2026-10-23"); // 00:00 PHT
    expect(manilaYmd(at("2026-10-21T16:00:00Z"))).toBe("2026-10-22"); // 00:00 PHT, still Oct 21 in UTC
  });
  it("range=today runs from Manila midnight to the next one", () => {
    const r = barberRange("today", null, null, at("2026-10-22T01:51:00Z")); // 09:51 PHT
    expect(r.from).toBe(at("2026-10-21T16:00:00Z"));
    expect(r.to).toBe(at("2026-10-22T16:00:00Z"));
    expect(r.label).toBe("Today, Oct 22");
    const late = barberRange("today", null, null, at("2026-10-22T16:30:00Z")); // 00:30 PHT Oct 23
    expect(late.label).toBe("Today, Oct 23");
    expect(late.from).toBe(at("2026-10-22T16:00:00Z"));
  });
  it("History presets use Manila days", () => {
    const now = at("2026-10-21T16:10:00Z"); // 00:10 PHT Oct 22
    expect(historyRange("7", now)).toEqual({ from: "2026-10-16", to: "2026-10-22" });
    expect(historyRange("month", now)).toEqual({ from: "2026-10-01", to: "2026-10-22" });
    expect(historyRange("lastMonth", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    const c = barberRange("custom", "2026-10-20", "2026-10-21", now);
    expect([c.from, c.to]).toEqual([at("2026-10-19T16:00:00Z"), at("2026-10-21T16:00:00Z")]);
  });
});
