import { describe, expect, it } from "vitest";
import { profitWeek, weekBounds } from "@/lib/profit-report";

const NOW = Date.parse("2026-10-25T02:00:00+08:00"); // Sunday Oct 25, 10:00 Manila

describe("Weekly profit report", () => {
  it("a week runs Sunday through Saturday in Manila", () => {
    const w = weekBounds(0, NOW);
    expect(w.days.map((d) => d.key)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
    expect(w.days[0]?.dow).toBe("Sun");
    expect(w.days[6]?.dow).toBe("Sat");
    expect(w.label).toBe("Week of Oct 25 - Oct 31, 2026");
    expect(w.days[0]?.date).toBe("10/25/2026");
    expect(weekBounds(-1, NOW).days[0]?.key).toBe("2026-10-18");
  });

  it("puts each barber’s finished sales on the day the cut was completed", () => {
    const sun = Date.parse("2026-10-25T04:00:00+08:00");
    const mon = Date.parse("2026-10-26T04:00:00+08:00");
    const chairs = [
      { id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", locationId: "sa" },
      { id: "c2", label: "Jay", barberId: "b-jay", barberName: "Jay", locationId: "sa", active: false },
    ];
    const rows = [
      { status: "done", completedAt: sun, price: 25_000, locationId: "sa", barberId: "b-keith", barberName: "Keith" },
      { status: "done", completedAt: mon, price: 55_000, locationId: "sa", barberId: "b-keith", barberName: "Keith" },
      { status: "done", completedAt: sun - 8 * 86_400_000, price: 99_000, locationId: "sa", barberId: "b-keith", barberName: "Keith" },
      { status: "done", completedAt: sun, price: 10_000, locationId: "pacita", barberId: "b-keith", barberName: "Keith" },
    ];
    const report = profitWeek(rows, chairs, "sa", 0, NOW, [{ id: "sa", name: "San Antonio" }]);
    const keith = report.rows.find((r) => r.id === "b-keith");
    expect(keith?.days).toEqual([25_000, 55_000, 0, 0, 0, 0, 0]);
    expect(keith?.total).toBe(80_000);
    expect(report.daily[0]).toBe(25_000);
    expect(report.daily[1]).toBe(55_000);
    expect(report.total).toBe(80_000);
    expect(report.rows.find((r) => r.id === "b-jay")).toBeUndefined();
  });
});
