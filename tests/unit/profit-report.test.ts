import { describe, expect, it } from "vitest";
import { compactPeso, profitWeek, weekBounds } from "@/lib/profit-report";

const NOW = Date.parse("2026-10-27T10:00:00+08:00"); // Tuesday Oct 27, 10:00 Manila

describe("Weekly profit report", () => {
  it("a week runs Monday through Sunday in Manila", () => {
    const w = weekBounds(0, NOW);
    expect(w.days.map((d) => d.key)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(w.days[0]?.dow).toBe("Mon");
    expect(w.days[6]?.dow).toBe("Sun");
    expect(w.label).toBe("Oct 26 – Nov 1, 2026");
    expect(w.days[0]?.date).toBe("10/26/2026");
    expect(weekBounds(-1, NOW).days[0]?.key).toBe("2026-10-19");
    expect(weekBounds(-1, NOW).label).toBe("Oct 19 – 25, 2026");
  });

  it("Sunday still belongs to the week that started the Monday before", () => {
    const sunday = Date.parse("2026-11-01T23:30:00+08:00");
    expect(weekBounds(0, sunday).days[0]?.key).toBe("2026-10-26");
    const monday = Date.parse("2026-11-02T00:10:00+08:00");
    expect(weekBounds(0, monday).days[0]?.key).toBe("2026-11-02");
  });

  it("compactPeso keeps grid cells short", () => {
    expect(compactPeso(98_000)).toBe("980");
    expect(compactPeso(160_000)).toBe("1.6k");
    expect(compactPeso(1_240_000)).toBe("12k");
  });

  it("puts each barber’s finished sales on the day the cut was completed", () => {
    const mon = Date.parse("2026-10-26T04:00:00+08:00");
    const tue = Date.parse("2026-10-27T04:00:00+08:00");
    const chairs = [
      { id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", locationId: "sa" },
      { id: "c2", label: "Jay", barberId: "b-jay", barberName: "Jay", locationId: "sa", active: false },
    ];
    const rows = [
      { status: "done", completedAt: mon, price: 25_000, locationId: "sa", barberId: "b-keith", barberName: "Keith" },
      { status: "done", completedAt: tue, price: 55_000, locationId: "sa", barberId: "b-keith", barberName: "Keith" },
      { status: "done", completedAt: mon - 8 * 86_400_000, price: 99_000, locationId: "sa", barberId: "b-keith", barberName: "Keith" },
      { status: "done", completedAt: mon, price: 10_000, locationId: "pacita", barberId: "b-keith", barberName: "Keith" },
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

  it("shows only the owner's share after each barber's split", () => {
    const mon = Date.parse("2026-10-26T04:00:00+08:00");
    const chairs = [
      { id: "c1", label: "Chair 1", barberId: "b-40", barberName: "Forty", sharePct: 40, shareSet: true },
      { id: "c2", label: "Chair 2", barberId: "b-none", barberName: "NoSplit" },
      { id: "c3", label: "Chair 3", barberId: "b-old50", barberName: "Old50", sharePct: 50 },
    ];
    const rows = [
      { status: "done", completedAt: mon, price: 35_000, barberId: "b-40", tip: 5_000 },
      { status: "done", completedAt: mon, price: 25_000, barberId: "b-none" },
      { status: "done", completedAt: mon, price: 20_000, barberId: "b-old50" },
      { status: "done", completedAt: mon, price: 30_000, barberId: "owner" },
    ];
    const report = profitWeek(rows, chairs, "all", 0, NOW);
    const by = (id: string) => report.rows.find((r) => r.id === id);
    expect(by("b-40")?.days[0]).toBe(21_000); // ₱350, barber keeps 40% → owner ₱210 (tip ignored)
    expect(by("b-none")?.total).toBe(25_000); // no split: all the owner's
    expect(by("b-old50")?.total).toBe(20_000); // bare legacy 50 reads as no split, like Sales
    expect(by("owner")?.total).toBe(30_000);
    expect(report.daily[0]).toBe(96_000);
    expect(report.total).toBe(96_000);
  });
});

import { profitMonth } from "@/lib/profit-report";
describe("Monthly profit report", () => {
  const NOW2 = Date.parse("2026-10-27T10:00:00+08:00");
  it("splits a month into Monday–Sunday weeks clipped to the month", () => {
    const m = profitMonth([], [], "all", 0, NOW2);
    expect(m.label).toBe("October 2026");
    expect(m.weeks.map((w) => w.range)).toEqual(["1–4", "5–11", "12–18", "19–25", "26–31"]);
    expect(profitMonth([], [], "all", -1, NOW2).weeks[0]?.range).toBe("1–6");
    expect(profitMonth([], [], "all", 3, NOW2).month).toBe("2027-01");
  });
  it("puts each cut's owner share in its week, counted on the Manila completion day", () => {
    const chairs = [{ id: "c1", label: "K", barberId: "k", barberName: "Keith", locationId: "sa", sharePct: 40, shareSet: true }];
    const rows = [
      { status: "done", completedAt: Date.parse("2026-10-04T23:30:00+08:00"), price: 10_000, locationId: "sa", barberId: "k" },
      { status: "done", completedAt: Date.parse("2026-10-05T00:10:00+08:00"), price: 10_000, locationId: "sa", barberId: "k" },
      { status: "done", completedAt: Date.parse("2026-09-30T23:59:00+08:00"), price: 10_000, locationId: "sa", barberId: "k" },
    ];
    const m = profitMonth(rows, chairs, "all", 0, NOW2);
    expect(m.rows[0]?.days.slice(0, 2)).toEqual([6_000, 6_000]);
    expect(m.total).toBe(12_000);
  });
});

import { dayBreakdown } from "@/lib/profit-report";
describe("Month calendar by day", () => {
  const NOW3 = Date.parse("2026-10-27T10:00:00+08:00");
  it("has one cell per day and the right Monday-first lead", () => {
    const m = profitMonth([], [], "all", 0, NOW3);
    expect(m.dates).toHaveLength(31);
    expect(m.dates[0]).toBe("2026-10-01");
    expect(m.lead).toBe(3); // Oct 1 2026 is a Thursday
    expect(profitMonth([], [], "all", -1, NOW3).lead).toBe(1); // Sep 1 2026 is a Tuesday
  });
  it("day totals and the day breakdown use the owner share on the Manila day", () => {
    const chairs = [{ id: "c1", label: "K", barberId: "k", barberName: "Keith", locationId: "sa", sharePct: 40, shareSet: true }, { id: "c2", label: "J", barberId: "j", barberName: "Jay", locationId: "sa" }];
    const rows = [
      { status: "done", completedAt: Date.parse("2026-10-05T23:50:00+08:00"), price: 10_000, locationId: "sa", barberId: "k" },
      { status: "done", completedAt: Date.parse("2026-10-05T09:00:00+08:00"), price: 20_000, locationId: "sa", barberId: "j" },
      { status: "done", completedAt: Date.parse("2026-10-06T00:05:00+08:00"), price: 10_000, locationId: "sa", barberId: "k" },
    ];
    const m = profitMonth(rows, chairs, "all", 0, NOW3);
    expect(m.dayTotals[4]).toBe(26_000);
    expect(m.dayTotals[5]).toBe(6_000);
    const d = dayBreakdown(m, "2026-10-05");
    expect(d.map((r) => [r.name, r.total])).toEqual([["Jay", 20_000], ["Keith", 6_000]]);
    expect(dayBreakdown(m, "2026-10-07")).toEqual([]);
  });
});
