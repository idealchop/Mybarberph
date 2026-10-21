import { describe, expect, it } from "vitest";
import { customerName, cutMinutes, sharePct, splitIncome, tipOf } from "@/lib/income-split";
import { editChanges } from "@/lib/edit-log";

describe("income split", () => {
  it("defaults to None (no split); a bare 50 from the old default is None too", () => {
    expect(sharePct({})).toBeNull();
    expect(sharePct({ sharePct: null, shareSet: false })).toBeNull();
    expect(sharePct({ sharePct: 50 })).toBeNull();
    expect(sharePct({ sharePct: 50, shareSet: true })).toBe(50);
    expect(splitIncome(100_000, null)).toEqual({ barber: 0, shop: 100_000 });
    expect(splitIncome(100_000, 50)).toEqual({ barber: 50_000, shop: 50_000 });
  });
  it("uses the owner's share and clamps bad values", () => {
    expect(sharePct({ sharePct: 60 })).toBe(60);
    expect(sharePct({ sharePct: 140, shareSet: true })).toBeNull();
    expect(sharePct({ sharePct: 0, shareSet: true })).toBe(0);
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

import { groupReport, normalizeGroups, toggleMember } from "@/lib/sales-groups";
import type { ChairRequest } from "@/lib/booking-types";
import { filterLocations } from "@/components/shell/location-switcher";

describe("sales groups", () => {
  const done = (o: Partial<ChairRequest>) => ({ id: Math.random().toString(36), status: "done", price: 100_000, ...o }) as ChairRequest;
  it("defaults to Group 1–3; otherwise keeps exactly the saved groups and names", () => {
    expect(normalizeGroups(null).map((x) => x.name)).toEqual(["Group 1", "Group 2", "Group 3"]);
    const g = normalizeGroups([{ id: "g2", name: " North ", locationIds: ["a", "a"] }]);
    expect(g.map((x) => x.name)).toEqual(["North"]);
    expect(g[0]!.locationIds).toEqual(["a"]);
    expect(normalizeGroups([{ id: "ga", name: "Group A" }, { id: "gb", name: "Group B" }, { id: "ga" }, { id: "bad id!" }]).map((x) => x.id)).toEqual(["ga", "gb"]);
  });
  it("sums a group's locations and barbers once, with net after the barber's share and tips apart", () => {
    const chairs = [{ id: "c1", label: "Jay", barberId: "b1", locationId: "home", sharePct: 60 }, { id: "c2", label: "Ben", barberId: "b2", locationId: "loc-x" }];
    const rows = [done({ locationId: "home", barberId: "b1", tip: 5000 }), done({ locationId: "loc-x", barberId: "b2" }), done({ locationId: "loc-y", barberId: "b3" })];
    let g = normalizeGroups(null)[0]!;
    g = toggleMember(g, "loc", "home");
    g = toggleMember(g, "barber", "b2");
    g = toggleMember(g, "barber", "b1"); // also at home: counted once
    const r = groupReport(rows, g, chairs, { loc: (id) => id });
    expect(r.cuts).toBe(2);
    expect(r.gross).toBe(200_000);
    expect(r.net).toBe(40_000 + 100_000); // Ben has no split: nothing taken off
    expect(r.tips).toBe(5000);
    expect(r.barbers.map((b) => b.id).sort()).toEqual(["b1", "b2"]);
    expect(toggleMember(g, "loc", "home").locationIds).toEqual([]);
  });
});

describe("location sheet search", () => {
  it("matches name or area", () => {
    const list = [{ id: "1", name: "Bayan", sub: "Cabuyao" }, { id: "2", name: "Niugan", sub: "Cabuyao City" }, { id: "3", name: "Pulo" }];
    expect(filterLocations(list, "cabuyao").map((x) => x.id)).toEqual(["1", "2"]);
    expect(filterLocations(list, " ").length).toBe(3);
  });
});
