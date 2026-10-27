import { describe, expect, it } from "vitest";
import { countCuts, cutBarberId, isBarbersCut, manilaYmd, mergeLiveRows } from "@/lib/cut-count";
import { barberStats } from "@/lib/sales-stats";
import { profitWeek } from "@/lib/profit-report";
import type { ChairRequest } from "@/lib/booking-types";

const chairs = [
  { id: "c1", label: "Chair 1", locationId: "home", barberId: "b-ana", barberName: "Ana" },
  { id: "c2", label: "Chair 1", locationId: "br2", barberId: "b-ben", barberName: "Ben" },
  { id: "c3", label: "Chair 3", locationId: "home", barberName: "Cy" }, // no separate barberId
];
let n = 0;
const row = (p: Partial<ChairRequest>): ChairRequest => ({ id: `r${++n}`, ref: "", status: "done", channel: "walk_in", createdAt: Date.now() - 3600_000, updatedAt: Date.now(), completedAt: Date.now() - 60_000, price: 10000, paid: true, locationId: "home", ...p } as ChairRequest);

describe("cutBarberId (one rule for barber link and owner)", () => {
  it("uses the snapshot barberId", () => expect(cutBarberId(row({ barberId: "b-ana" }), chairs)).toBe("b-ana"));
  it("legacy seat-only rows go to the seat's barber at the same branch", () => {
    expect(cutBarberId(row({ seatLabel: "Chair 1" }), chairs)).toBe("b-ana");
    expect(cutBarberId(row({ seatLabel: "Chair 1", locationId: "br2" }), chairs)).toBe("b-ben");
    expect(cutBarberId(row({ chairLabel: "Chair 3" }), chairs)).toBe("c3");
  });
  it("a stale chair id snapshot maps to that chair's barber (was split into two owner rows)", () => {
    expect(cutBarberId(row({ barberId: "c1" }), chairs)).toBe("b-ana");
  });
  it("unknown seat stays its own bucket", () => expect(cutBarberId(row({ seatLabel: "X" }), chairs)).toBe("seat:home:X"));
});

describe("barber and owner count the same cuts", () => {
  const now = Date.now();
  const rows = [
    row({ barberId: "b-ana" }), row({ barberId: "c1" }), row({ seatLabel: "Chair 1" }), // 3 Ana at home
    row({ barberId: "b-ana", status: "in_chair", completedAt: undefined }), // not finished
    row({ barberId: "b-ana", status: "cancelled" }),
    row({ seatLabel: "Chair 1", locationId: "br2" }), // Ben, other branch
    row({ barberId: "b-ana", channel: "manual" as ChairRequest["channel"] }), // manual record counts
  ];
  it("barber link count == owner Sales count == profit report count", () => {
    const link = rows.filter((r) => isBarbersCut(r, "b-ana", chairs, { locationId: "home" })).length;
    const sales = barberStats(rows, "today", "all", [{ id: "home", name: "Main" }, { id: "br2", name: "B2" }], chairs).find((b) => b.id === "b-ana" && b.locationId === "home")?.cuts;
    const counted = countCuts(rows, chairs, now - 86_400_000, now + 1).get("b-ana@home");
    expect(link).toBe(4);
    expect(sales).toBe(4);
    expect(counted).toBe(4);
    const week = profitWeek(rows, chairs, "all", 0, now, [{ id: "home", name: "Main" }, { id: "br2", name: "B2" }]);
    expect(JSON.stringify(week)).toBeTruthy();
  });
  it("counts by Manila day, not UTC", () => {
    const at = Date.parse("2026-10-25T16:30:00Z"); // 00:30 Oct 26 Manila
    expect(manilaYmd(at)).toBe("2026-10-26");
    const from = Date.parse("2026-10-26T00:00:00+08:00");
    expect(isBarbersCut(row({ barberId: "b-ana", completedAt: at }), "b-ana", chairs, { from, to: from + 86_400_000 })).toBe(true);
    expect(isBarbersCut(row({ barberId: "b-ana", completedAt: from - 1 }), "b-ana", chairs, { from, to: from + 86_400_000 })).toBe(false);
  });
});

describe("mergeLiveRows (owner history + live, so a just-finished cut shows)", () => {
  it("live edits win, live-only rows join, old history stays", () => {
    const old = { id: "a", createdAt: 1, status: "done" };
    const stale = { id: "b", createdAt: 10, status: "in_chair" };
    const live = [{ id: "b", createdAt: 10, status: "done" }, { id: "c", createdAt: 11, status: "done" }];
    const out = mergeLiveRows([old, stale], live);
    expect(out.map((r) => `${r.id}:${r.status}`).sort()).toEqual(["a:done", "b:done", "c:done"]);
  });
  it("falls back to live rows before history loads", () => expect(mergeLiveRows(null, [{ id: "x", createdAt: 1 }])).toHaveLength(1));
});
