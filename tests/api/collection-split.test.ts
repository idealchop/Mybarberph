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

import { claimOwnerShare, ownerShareOf } from "@/lib/income-split";
describe("Claim = owner's share", () => {
  it("50% barber: ₱2,750 cash → owner claims ₱1,375; 60% barber → owner 40%", () => {
    expect(ownerShareOf(275000, 50)).toBe(137500);
    expect(ownerShareOf(100000, 60)).toBe(40000);
  });
  it("split None: the owner gets the full amount", () => {
    expect(ownerShareOf(275000, null)).toBe(275000);
  });
  it("new claims keep their stored share; old claims are computed from the barber's split", () => {
    expect(claimOwnerShare({ amount: 275000, ownerShare: 110000 }, 50)).toBe(110000);
    expect(claimOwnerShare({ amount: 275000 }, 50)).toBe(137500);
    expect(claimOwnerShare({ amount: 75000 }, null)).toBe(75000);
  });
});
