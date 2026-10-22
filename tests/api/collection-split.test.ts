import { describe, expect, it } from "vitest";
import { splitLine, splitTotals } from "@/lib/income-split";
const peso = (c: number) => `₱${(c / 100).toLocaleString("en-PH")}`;
describe("Collection split lines", () => {
  it("50% barber: Shop ₱1,375 · Barber ₱1,375 under ₱2,750", () => {
    const t = splitTotals([{ amount: 275000, pct: 50 }]);
    expect(t.total).toBe(275000);
    expect(splitLine(t, peso)).toBe("Shop ₱1,375 · Barber ₱1,375");
  });
  it("None split shows just the total (no line)", () => {
    expect(splitLine(splitTotals([{ amount: 275000, pct: null }]), peso)).toBeNull();
  });
  it("mixed barbers add the no-split part separately", () => {
    expect(splitLine(splitTotals([{ amount: 100000, pct: 60 }, { amount: 50000, pct: null }]), peso)).toBe("Shop ₱400 · Barber ₱600 · No split ₱500");
  });
});
