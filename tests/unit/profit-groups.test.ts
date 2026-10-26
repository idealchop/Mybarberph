import { describe, expect, it } from "vitest";
import { groupProfitRows, type ProfitRow } from "@/lib/profit-report";

const row = (id: string, locationId: string, days: number[]): ProfitRow => ({ id, name: id, locationId, locationName: locationId, days, total: days.reduce((s, n) => s + n, 0) });
const rows = [
  row("a", "sa", [100, 0, 0, 0, 0, 0, 0]),
  row("b", "sa", [50, 50, 0, 0, 0, 0, 0]),
  row("c", "bb", [0, 200, 0, 0, 0, 0, 0]),
  row("d", "cc", [0, 0, 300, 0, 0, 0, 0]),
];

describe("Profit report grouped like Sales groups", () => {
  it("keeps the saved group order and names, with per-day and week subtotals", () => {
    const g = groupProfitRows(rows, [
      { id: "g2", name: "North", locationIds: ["bb"], barberIds: [] },
      { id: "g1", name: "South", locationIds: ["sa"], barberIds: [] },
    ]);
    expect(g.map((x) => x.name)).toEqual(["North", "South", "Not in a group"]);
    expect(g[1]?.days.slice(0, 2)).toEqual([150, 50]);
    expect(g[1]?.total).toBe(200);
    expect(g[2]?.rows.map((r) => r.id)).toEqual(["d"]);
  });

  it("a barber added by name joins the group; empty groups are hidden; no leftover section when all are placed", () => {
    const g = groupProfitRows(rows, [
      { id: "g1", name: "Group 1", locationIds: ["sa", "bb"], barberIds: ["d"] },
      { id: "g2", name: "Group 2", locationIds: [], barberIds: [] },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]?.total).toBe(700);
  });
});
