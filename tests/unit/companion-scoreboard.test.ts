import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server/shops", () => ({ loadState: vi.fn(), shopRef: vi.fn() }));
import { barberOf, getSales, mergeBookings, scoreboard, scoreboardText, staffPerformance, type ShopData } from "@/lib/server/companion/data";
import type { ChairRequest } from "@/lib/booking-types";

// Mon Oct 26 2026, 15:00 Manila. The bug: owner asked Glenmar's cuts today and got the whole shop's count.
const NOW = Date.parse("2026-10-26T15:00:00+08:00");
const at = (iso: string) => Date.parse(`${iso}+08:00`);
let n = 0;
const cut = (p: Partial<ChairRequest>): ChairRequest => ({ id: `r${++n}`, status: "done", price: 20_000, channel: "walk-in", createdAt: (p.completedAt ?? NOW) - 1_800_000, updatedAt: p.completedAt ?? NOW, ...p } as ChairRequest);

function shop(): ShopData {
  const bookings: ChairRequest[] = [];
  // Glenmar at Banay-Banay I: 15 finished today.
  for (let i = 0; i < 15; i++) bookings.push(cut({ locationId: "bb1", barberId: "glen", barberName: "Glenmar Paclibar", seatLabel: "Chair 1", completedAt: at(`2026-10-26T${String(8 + Math.floor(i / 3)).padStart(2, "0")}:${String((i % 3) * 15).padStart(2, "0")}:00`) }));
  // Same barber yesterday (Sunday) and just before Manila midnight (16:30Z Oct 25 = 00:30 Oct 26 Manila counts; 15:30Z = 23:30 Oct 25 doesn't).
  for (let i = 0; i < 6; i++) bookings.push(cut({ locationId: "bb1", barberId: "glen", barberName: "Glenmar Paclibar", seatLabel: "Chair 1", completedAt: at("2026-10-25T14:00:00") + i * 60_000 }));
  bookings.push(cut({ locationId: "bb1", barberId: "glen", barberName: "Glenmar Paclibar", seatLabel: "Chair 1", completedAt: Date.parse("2026-10-25T15:30:00Z") }));
  // Other barbers / another branch today, with the same chair label.
  for (let i = 0; i < 10; i++) bookings.push(cut({ locationId: "bb1", barberId: "jun", barberName: "Jun", seatLabel: "Chair 2", completedAt: at("2026-10-26T10:00:00") + i * 60_000 }));
  for (let i = 0; i < 14; i++) bookings.push(cut({ locationId: "bb2", barberId: "rey", barberName: "Rey", seatLabel: "Chair 1", completedAt: at("2026-10-26T11:00:00") + i * 60_000 }));
  // Unfinished tickets today never count.
  bookings.push(cut({ locationId: "bb1", barberId: "glen", status: "in_chair", completedAt: undefined, updatedAt: NOW }));
  bookings.push(cut({ locationId: "bb1", barberId: "glen", status: "accepted", completedAt: undefined, updatedAt: NOW }));
  return {
    shopName: "Boyet Barbershop", plan: "pro", bookings,
    chairs: [
      { id: "c1", label: "Chair 1", barberId: "glen", barberName: "Glenmar Paclibar", locationId: "bb1" },
      { id: "c2", label: "Chair 2", barberId: "jun", barberName: "Jun", locationId: "bb1" },
      { id: "c3", label: "Chair 1", barberId: "rey", barberName: "Rey", locationId: "bb2" },
    ],
    branches: [{ id: "bb1", name: "Banay-Banay I" }, { id: "bb2", name: "Banay-Banay II" }],
  };
}

describe("Companion scoreboard (today = Manila day, finished cuts only)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => vi.useRealTimers());

  it("a barber's today count excludes previous days, other branches and unfinished tickets", () => {
    const s = scoreboard(shop(), NOW);
    expect(s.todayDate).toBe("2026-10-26");
    const bb1 = s.branches.find((b) => b.locationId === "bb1")!;
    expect(bb1.barbers.find((b) => b.barber === "Glenmar Paclibar")?.today.cuts).toBe(15);
    expect(bb1.today.cuts).toBe(25);
    expect(s.branches.find((b) => b.locationId === "bb2")?.today.cuts).toBe(14);
    expect(s.total.today.cuts).toBe(39);
  });

  it("this week runs Monday to Sunday, so Sunday's cuts are last week's", () => {
    const s = scoreboard(shop(), NOW);
    expect(s.weekFrom).toBe("2026-10-26");
    expect(s.weekTo).toBe("2026-11-01");
    expect(s.total.thisWeek.cuts).toBe(39);
  });

  it("the context text labels every figure with its date and branch", () => {
    const t = scoreboardText(shop(), NOW);
    expect(t).toContain("TODAY = 2026-10-26");
    expect(t).toContain("WHOLE SHOP (all branches combined): today 39 cuts");
    expect(t).toContain("BRANCH Banay-Banay I (id bb1): today 25 cuts");
    expect(t).toContain("- Glenmar Paclibar at Banay-Banay I: today 15 cuts");
  });

  it("staffPerformance with days=1 is today only (not the last 24 hours) and per branch", () => {
    const r = staffPerformance(shop(), { days: 1 });
    expect(r.period).toContain("2026-10-26 to 2026-10-26");
    const glen = r.barbers.filter((b) => b.barber === "Glenmar Paclibar");
    expect(glen).toHaveLength(1);
    expect(glen[0]?.cuts).toBe(15);
    expect(r.barbers.find((b) => b.barber === "Rey")?.branch).toBe("Banay-Banay II");
  });

  it("the same chair label in two branches maps to the right barber", () => {
    const d = shop();
    expect(barberOf(d, cut({ locationId: "bb2", seatLabel: "Chair 1" }))).toBe("Rey");
    expect(barberOf(d, cut({ locationId: "bb1", seatLabel: "Chair 1" }))).toBe("Glenmar Paclibar");
  });

  it("getSales says which branch and dates it covers; an unknown branch is flagged, not silently the whole shop", () => {
    expect(getSales(shop(), { days: 1, locationId: "Banay-Banay I" })).toMatchObject({ cuts: 25, branch: "Banay-Banay I", period: "2026-10-26 to 2026-10-26 (Manila)" });
    expect(String(getSales(shop(), { days: 1, locationId: "Nowhere" }).branch)).toContain("ALL branches");
  });

  it("tickets read twice (created + completed queries) count once", () => {
    const a = cut({ id: "x" } as Partial<ChairRequest>);
    expect(mergeBookings([a, a, cut({})])).toHaveLength(2);
  });
});
