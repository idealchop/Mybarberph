import { describe, expect, it } from "vitest";
import { customerName, cutMinutes, sharePct, splitIncome, tipOf } from "@/lib/income-split";
import { editChanges } from "@/lib/edit-log";

describe("income split", () => {
  it("defaults to 50% and splits ₱1,000 into ₱500 / ₱500", () => {
    expect(sharePct({})).toBe(50);
    expect(splitIncome(100_000, 50)).toEqual({ barber: 50_000, shop: 50_000 });
  });
  it("uses the owner's share and clamps bad values", () => {
    expect(sharePct({ sharePct: 60 })).toBe(60);
    expect(sharePct({ sharePct: 140 })).toBe(50);
    expect(splitIncome(100_001, 60)).toEqual({ barber: 60_001, shop: 40_000 });
  });
  it("reads tips as centavos", () => {
    expect(tipOf({ tip: 5000 })).toBe(5000);
    expect(tipOf({})).toBe(0);
    expect(tipOf({ tip: -1 })).toBe(0);
  });
});

describe("labels and speed", () => {
  it("drops the default Walk-in label", () => {
    expect(customerName({ customerLabel: "Walk-in" })).toBe("");
    expect(customerName({ customerLabel: "Jay" })).toBe("Jay");
  });
  it("times a cut and ignores forgotten timers", () => {
    expect(cutMinutes({ startedAt: 0, completedAt: 25 * 60_000 })).toBeNull(); // no start
    expect(cutMinutes({ startedAt: 1, completedAt: 1 + 25 * 60_000 })).toBe(25);
    expect(cutMinutes({ startedAt: 1, completedAt: 1 + 300 * 60_000 })).toBeNull();
  });
});

describe("edit log", () => {
  it("describes changed details", () => {
    const a = { customerLabel: "Walk-in", price: 15000, paid: true, payMethod: "cash" as const };
    const b = { customerLabel: "Jay", price: 20000, paid: true, payMethod: "gcash" as const, tip: 5000 };
    expect(editChanges(a, b)).toEqual(["Name: Walk-in → Jay", "Amount: ₱150 → ₱200", "Payment: cash → GCash", "Tip: ₱0 → ₱50"]);
    expect(editChanges(a, a)).toEqual([]);
  });
});
