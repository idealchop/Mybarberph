import { describe, expect, it } from "vitest";
import { markSameNames, profitWeek, type ProfitChair, type ProfitVisit } from "@/lib/profit-report";
import { cutsLabel, scopeCutsLabel, totalLabel, totalScope } from "@/lib/total-labels";
import { asOfLabel, HISTORY_REFRESH_MS } from "@/lib/barber-history";

const now = Date.parse("2026-10-31T18:30:00+08:00");
const at = Date.parse("2026-10-31T12:00:00+08:00");
const chairs: ProfitChair[] = [
  { id: "c-eddie", label: "Eddie", barberId: "b-eddie", barberName: "Eddie Emperador", locationId: "home" },
  { id: "c-ray-home", label: "Raymond Dias", barberId: "b-ray-home", barberName: "Raymond Dias", locationId: "home", vacantAt: at - 1 },
  { id: "c-ray-n", label: "Raymond Dias", barberId: "b-ray-n", barberName: "Raymond Dias", locationId: "loc-n", vacantAt: at - 1 },
  { id: "c-idle", label: "Idle", barberId: "b-idle", barberName: "Idle", locationId: "home", vacantAt: at - 1 },
];
const cut = (barberId: string, locationId: string): ProfitVisit => ({ status: "done", completedAt: at, price: 14000, barberId, locationId });

describe("v1.0.35 vacantAt barbers and same-name barbers", () => {
  it("hides a vacantAt barber with no haircuts, lists one with haircuts normally", () => {
    const w = profitWeek([cut("b-eddie", "home"), cut("b-ray-home", "home")], chairs, "all", 0, now);
    const ids = w.rows.map((r) => r.id);
    expect(ids).not.toContain("b-idle");
    expect(ids).not.toContain("b-ray-n");
    expect(ids).toContain("b-ray-home");
    expect(Object.keys(w.rows.find((r) => r.id === "b-ray-home")!)).not.toContain("vacant");
  });
  it("flags barbers sharing a name across branches", () => {
    const w = profitWeek([cut("b-ray-home", "home")], chairs, "home", 0, now);
    expect(w.rows.find((r) => r.id === "b-ray-home")?.sameName).toBe(true);
    expect(markSameNames([{ id: "b-eddie", name: "Eddie Emperador", locationId: "home" }], chairs)[0].sameName).toBe(false);
  });
});

describe("v1.0.35 total labels", () => {
  it("says whose total it is, with haircut plurals", () => {
    expect(cutsLabel(1)).toBe("1 haircut");
    expect(scopeCutsLabel(41, "branch")).toBe("41 haircuts · branch total");
    expect(totalLabel("all")).toBe("All branches total");
    expect(totalLabel("shop")).toBe("Shop total");
    expect(totalScope({ enabled: true, viewingAll: false })).toBe("branch");
    expect(totalScope({ enabled: false, viewingAll: true })).toBe("shop");
  });
});

describe("v1.0.35 History freshness", () => {
  it("refreshes every minute and shows Manila time", () => {
    expect(HISTORY_REFRESH_MS).toBe(60_000);
    expect(asOfLabel(Date.parse("2026-10-31T17:48:00+08:00"))).toBe("as of 5:48 PM");
  });
});
