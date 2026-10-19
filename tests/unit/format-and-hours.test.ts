import { describe, expect, it } from "vitest";
import { peso } from "@/lib/format";
import { formatHours, parseWeek, week } from "@/lib/shop-hours";

describe("peso (prices are stored in centavos)", () => {
  it("TC-FMT-HP-01 whole pesos have no decimals", () => {
    expect(peso(1_845_000)).toBe("₱18,450");
  });
  it("TC-FMT-ODD-01 keeps centavos only when present; signed adds +", () => {
    expect(peso(12_345)).toBe("₱123.45");
    expect(peso(5_000, { signed: true })).toBe("+₱50");
    expect(peso(0, { signed: true })).toBe("₱0");
  });
});

describe("shop hours", () => {
  it("TC-HOURS-HP-01 the same hours every day read as Everyday", () => {
    expect(formatHours(week(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))).toMatch(/^Everyday /);
  });
  it("TC-HOURS-ODD-01 no open day reads as Closed", () => {
    expect(formatHours(week([]))).toBe("Closed");
  });
  it("TC-HOURS-NEG-01 parseWeek rejects non-objects and repairs invalid times", () => {
    expect(parseWeek(null)).toBeNull();
    expect(parseWeek("mon")).toBeNull();
    const w = parseWeek({ mon: { open: true, from: "25:99", to: "18:00" } })!;
    expect(w.mon).toEqual({ open: true, from: "09:00", to: "18:00" });
    expect(w.tue.open).toBe(false);
  });
});
