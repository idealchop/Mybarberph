import { describe, expect, it } from "vitest";
import { profitWeek, rankProfitRows } from "@/lib/profit-report";

const NOW = Date.parse("2026-10-27T10:00:00+08:00");
const mon = Date.parse("2026-10-26T04:00:00+08:00");
const tue = Date.parse("2026-10-27T04:00:00+08:00");

describe("owner weekly totals chart (v1.0.29)", () => {
  const chairs = [
    { id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", locationId: "sa", sharePct: 50, shareSet: true },
    { id: "c2", label: "Jay", barberId: "b-jay", barberName: "Jay", locationId: "sb" },
    { id: "c3", label: "Ana", barberId: "b-ana", barberName: "Ana", locationId: "sa" },
  ];
  const rows = [
    { status: "done", completedAt: mon, price: 40_000, locationId: "sa", barberId: "b-keith" },
    { status: "done", completedAt: tue, price: 30_000, locationId: "sa", barberId: "b-keith" },
    { status: "done", completedAt: tue, price: 25_000, locationId: "sb", barberId: "b-jay" },
  ];
  it("chart totals equal table totals and order highest first, zero-sales last", () => {
    const w = profitWeek(rows, chairs, "all", 0, NOW, [{ id: "sa", name: "SA" }, { id: "sb", name: "SB" }]);
    const r = rankProfitRows(w.rows);
    const sum = [...r.ranked, ...r.zero].reduce((s, x) => s + x.total, 0);
    expect(sum).toBe(w.total);
    for (const x of [...r.ranked, ...r.zero]) expect(x.total).toBe(w.rows.find((t) => t.id === x.id && t.locationId === x.locationId)!.total);
    expect(r.ranked.map((x) => x.total)).toEqual([...r.ranked.map((x) => x.total)].sort((a, b) => b - a));
    expect(r.top?.total).toBe(Math.max(...w.rows.map((x) => x.total)));
    expect(r.lowest?.total).toBe(Math.min(...w.rows.filter((x) => x.total > 0).map((x) => x.total)));
    expect(r.zero.map((x) => x.name)).toEqual(["Ana"]);
  });
  it("location filter matches the table", () => {
    const w = profitWeek(rows, chairs, "sb", 0, NOW);
    const r = rankProfitRows(w.rows);
    expect(r.ranked.reduce((s, x) => s + x.total, 0)).toBe(w.total);
    expect(r.lowest).toBeNull();
  });
});
