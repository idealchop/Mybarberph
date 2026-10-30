import { describe, expect, it } from "vitest";
import { splitIncome, ownerShareOf, visitPct } from "@/lib/income-split";

describe("profit split invariants", () => {
  it("owner + barber = price for every price/pct, barber rounded, owner gets remainder", () => {
    for (let peso = 0; peso <= 1000; peso += 5) for (let pct = 0; pct <= 100; pct++) {
      const price = peso * 100; const s = splitIncome(price, pct);
      expect(s.barber + s.shop).toBe(price);
      expect(ownerShareOf(price, pct)).toBe(s.shop);
    }
  });
  it("45% of ₱75 has no lost centavos", () => {
    const s = splitIncome(7500, 45); expect(s.barber).toBe(3375); expect(s.shop).toBe(4125);
  });
  it("no split set: owner keeps the full price", () => { expect(ownerShareOf(7500, null)).toBe(7500); });
  it("split changed mid-week: stamped % wins, legacy rows use the current one", () => {
    expect(visitPct({ splitPct: 40 }, 60)).toBe(40);
    expect(visitPct({}, 60)).toBe(60);
    expect(visitPct({ splitPct: null }, 60)).toBe(null);
  });
});
