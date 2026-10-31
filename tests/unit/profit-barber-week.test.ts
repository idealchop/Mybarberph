import { describe, expect, it } from "vitest";
import { profitWeek } from "@/lib/profit-report";
import { claimStates } from "@/lib/profit-claim";
import { barberWeekView } from "@/lib/profit-barber-week";

const NOW = Date.parse("2026-10-28T18:00:00+08:00"); // Wed Oct 28 Manila
const at = (d: string) => Date.parse(`${d}T12:00:00+08:00`);

describe("Barber week view (row tap on the Weekly Profit Report)", () => {
  const chairs = [{ id: "c1", label: "Ray", barberId: "b-ray", barberName: "Ray", locationId: "pac", sharePct: 40, shareSet: true }];
  const rows = [
    { id: "v1", status: "done", paid: true, payMethod: "cash", completedAt: at("2026-10-26"), price: 50_000, locationId: "pac", barberId: "b-ray" },
    { id: "v2", status: "done", paid: true, payMethod: "gcash", completedAt: at("2026-10-27"), price: 30_000, locationId: "pac", barberId: "b-ray" },
    { id: "v3", status: "done", paid: true, payMethod: "cash", completedAt: at("2026-10-28"), price: 20_000, locationId: "pac", barberId: "b-ray" },
  ];
  const claimedIds = new Set(["v1"]);
  const week = profitWeek(rows, chairs, "all", 0, NOW, [{ id: "pac", name: "Pacita" }]);
  const map = claimStates(rows, chairs, (r) => claimedIds.has(r.id));
  const row = week.rows.find((r) => r.id === "b-ray")!;

  it("day values and total equal the grid row (GCash included, owner split)", () => {
    const v = barberWeekView(row, week.days, map, "2026-10-28");
    expect(v.days.map((d) => d.amount)).toEqual(row.days);
    expect(v.total).toBe(row.total);
    expect(v.days.reduce((s, d) => s + d.amount, 0)).toBe(row.total);
    expect(row.days.slice(0, 3)).toEqual([30_000, 18_000, 12_000]);
  });

  it("claim colours and to-claim/claimed split follow the grid's claim map", () => {
    const v = barberWeekView(row, week.days, map, "2026-10-28");
    expect(v.days.slice(0, 4).map((d) => d.state)).toEqual(["claimed", "open", "open", null]);
    expect(v.toClaim).toBe(30_000);
    expect(v.claimed).toBe(30_000);
    expect(v.days[2]?.today).toBe(true);
    expect(v.days[3]?.future).toBe(true);
    // Optimistic claim: a new claimed set re-derives at once.
    const after = barberWeekView(row, week.days, claimStates(rows, chairs, () => true), "2026-10-28");
    expect(after.toClaim).toBe(0);
    expect(after.claimed).toBe(row.total);
  });
});
