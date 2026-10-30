import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.26 (Jimboy: "why 12 customers when Pacita is active?"). Every Home and Queue number for the selected
// location must agree, for each single location and for All. In-memory only.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const { inLocation } = await import("@/lib/shop-locations");
const { rowsForLocation } = await import("@/lib/queue-location");
const { todayFigures } = await import("@/lib/chair-bookings");
const { asOwnerSplit } = await import("@/lib/split-view");
const { dayBoard, todayKey } = await import("@/lib/queue-day");
const { profitWeek } = await import("@/lib/profit-report");
const { ownerDayTotal } = await import("@/lib/counts");
const { claimStates } = await import("@/lib/profit-claim");
const { remitSummary } = await import("@/lib/server/remit");

const chairs = [
  { id: "c1", label: "Mark", barberId: "b-mark", barberName: "Mark Santos", locationId: "pacita", sharePct: 40, shareSet: true },
  { id: "c2", label: "Ray", barberId: "b-ray", barberName: "Raymond Diaz", locationId: "bayan", sharePct: 50, shareSet: true },
  { id: "c3", label: "Mark", barberId: "b-mark", barberName: "Mark Santos", locationId: "bayan", sharePct: 45, shareSet: true },
];
const branches = [{ id: "pacita", name: "Pacita (Demo)" }, { id: "bayan", name: "Bayan" }];
const now = Date.now(), today = todayKey(now);
const t0 = Math.max(Date.parse(`${today}T00:00:00+08:00`) + 60_000, now - 6 * 3600_000);
let n = 0;
const v = (loc: string, barberId: string, status: string, o: Record<string, unknown> = {}) => {
  const at = t0 + (n++ % 300) * 60_000;
  return { id: `v${n}`, ref: `R${n}`, status, channel: "walk-in", createdAt: at - 1000, updatedAt: at, ...(status === "done" ? { completedAt: at } : {}), price: 15000, paid: status === "done", payMethod: n % 3 ? "cash" : "gcash", barberId, locationId: loc, serviceName: "Haircut", customerLabel: "Walk-in", contact: "", ...o };
};
const rows = [
  ...Array.from({ length: 11 }, () => v("pacita", "b-mark", "done")),
  v("pacita", "b-mark", "accepted"), // the 1 waiting at Pacita
  ...Array.from({ length: 6 }, () => v("bayan", "b-ray", "done")),
  ...Array.from({ length: 2 }, () => v("bayan", "b-mark", "done")),
  v("bayan", "b-ray", "in_chair"), v("bayan", "b-ray", "requested"),
  v("bayan", "owner", "done", { barberName: "Owner" }), // owner's own cut: counts as a haircut, never claimed
  v("pacita", "b-mark", "accepted", { createdAt: t0 - 86_400_000 * 2 }), // left open 2 days ago: never "waiting" today
  v("pacita", "b-mark", "done", { completedAt: undefined }), // done with no completion time: no screen counts it
  v("pacita", "b-mark", "declined"),
] as never as import("@/lib/chair-bookings").ChairRequest[];

for (const r of rows) fs.store[`shops/x/bookings/${r.id}`] = r;
fs.store["shops/x"] = { name: "X" };
fs.store["shops/x/private/chairs"] = { json: JSON.stringify(chairs) };

describe("Home and Queue agree for the selected location", () => {
  for (const loc of ["pacita", "bayan", "all"]) {
    it(loc, async () => {
      const all = loc === "all";
      const home = rows.filter((r) => inLocation(r.locationId, true, all, all ? null : loc));
      const queue = rowsForLocation(rows, loc, all, "home");
      expect(queue.map((r) => r.id)).toEqual(home.map((r) => r.id)); // same scope on both pages

      const split = asOwnerSplit(home, chairs as never);
      const fig = todayFigures(split); const board = dayBoard(home, today);
      // hero haircuts = Today's barbers done = Customers = Queue Completed
      expect(board.done).toBe(fig.cuts);
      // per-barber sums (shared counting module) = owner totals
      const own = ownerDayTotal(home as never, chairs, today, all ? "all" : loc);
      expect(own.haircuts).toBe(fig.cuts); expect(own.owner).toBe(fig.sales);
      // weekly card "Today" = hero sales (owner share)
      const w = profitWeek(rows, chairs as never, all ? "all" : loc, 0, now, branches);
      expect(w.daily[w.days.findIndex((d) => d.key === today)]).toBe(fig.sales);
      // Home To Claim (owner share, server) = the profit grid's open owner share for that location
      const s = await remitSummary("x", all ? "all" : loc);
      let gridOpen = 0; for (const [k, c] of claimStates(rows, chairs, () => false)) { const l = k.slice(k.indexOf("@") + 1, k.indexOf("|")); if (all || l === loc) gridOpen += c.openOwner; }
      expect(s.ownerTotal).toBe(gridOpen);
      if (loc === "pacita") expect([board.done, board.waiting, board.inChair, board.current]).toEqual([11, 1, 0, 1]);
      if (loc === "bayan") expect([board.done, board.waiting, board.inChair, board.current]).toEqual([9, 1, 1, 2]);
      if (all) expect([board.done, board.current]).toEqual([20, 3]);
    });
  }
});
