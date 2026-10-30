import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.27: the Companion's numbers must equal the owner's Sales / profit numbers (shared counting module) for the
// same branch and window, and what the model reads must say "haircuts" and "owner share", never "cuts"/"sales".
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const D = await import("@/lib/server/companion/data");
const { ownerDayTotal } = await import("@/lib/counts");
const { profitWeek } = await import("@/lib/profit-report");

const chairs = [
  { id: "c1", label: "Mark", barberId: "b-mark", barberName: "Mark Santos", locationId: "loc-demo-pacita", sharePct: 40, shareSet: true },
  { id: "c2", label: "Jay", barberId: "b-jay", barberName: "Jay", locationId: "home", sharePct: 50, shareSet: true },
];
const branches = [{ id: "home", name: "San Antonio" }, { id: "loc-demo-pacita", name: "Pacita (Demo)" }];
const DAY = 86_400_000, now = Date.now();
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const rows: Record<string, unknown>[] = [];
for (let d = 0; d < 40; d++) for (let j = 0; j < 12; j++) {
  const at = Math.min(now - 60_000, Date.parse(`${ymd(now - d * DAY)}T09:00:00+08:00`) + j * 1800_000);
  const c = chairs[j % 2]!;
  rows.push({ id: `v${d}-${j}`, ref: `R${d}${j}`, status: j === 11 ? "accepted" : "done", channel: "walk-in", createdAt: at - 60_000, updatedAt: at, ...(j === 11 ? {} : { completedAt: at }), price: 15000 + (j % 3) * 5000, tip: j % 4 ? 0 : 2000, paid: true, payMethod: j % 3 ? "cash" : "gcash", barberId: c.barberId, locationId: c.locationId, serviceName: "Haircut", customerLabel: "Walk-in", contact: "" });
}
fs.store["shops/s1"] = { name: "Bossing" };
fs.store["shops/s1/private/chairs"] = { json: JSON.stringify(chairs) };
fs.store["shops/s1/private/locations"] = { json: JSON.stringify({ enabled: true, branches }) };
for (const r of rows) fs.store[`shops/s1/bookings/${r.id}`] = r;

describe("Companion context = Sales / profit numbers", () => {
  it("per branch, 30 days and today, owner share, finished haircuts only", async () => {
    const d = await D.loadShopData("s1", "Bossing", "paid");
    expect(d.branches.map((b) => b.id)).toEqual(["home", "loc-demo-pacita"]); // current branch ids, not stale names
    const start = D.windowStart(30, now);
    const days = Array.from({ length: 30 }, (_, i) => ymd(start + i * DAY));
    const cmp = D.branchComparison(d, { days: 30 });
    for (const br of cmp.branches) {
      let n = 0, share = 0; for (const day of days) { const t = ownerDayTotal(rows as never, chairs, day, br.locationId); n += t.haircuts; share += t.owner; }
      expect(br.cuts).toBe(n); expect(Math.round(br.salesPhp * 100)).toBe(share);
    }
    const sb = D.scoreboard(d, now); const today = ymd(now);
    const all = ownerDayTotal(rows as never, chairs, today);
    expect(sb.total.today.cuts).toBe(all.haircuts); expect(Math.round(sb.total.today.salesPhp * 100)).toBe(all.owner);
    // weekly profit grid "Today" = the Companion's today (owner share)
    const w = profitWeek(rows as never, chairs as never, "all", 0, now, branches);
    expect(Math.round(sb.total.today.salesPhp * 100)).toBe(w.daily[w.days.findIndex((x) => x.key === today)]);
  });
  it("what the model reads says haircuts and owner share, never cuts or sales", async () => {
    const d = await D.loadShopData("s1", "Bossing", "paid");
    const txt = JSON.stringify(D.forModel({ a: D.branchComparison(d, { days: 30 }), b: D.getSales(d, { days: 7 }), c: D.staffPerformance(d, { days: 30 }), g: D.goalProgress(d, [{ id: "g", kind: "weekly_cuts", targetCount: 50, text: "50", createdAt: 0 }]) }));
    expect(txt).not.toMatch(/"(cuts|salesPhp|avgTicketPhp|previousPeriodCuts|cutsThisWeek|monthSalesPhp)"/);
    expect(txt).toMatch(/"haircuts"/); expect(txt).toMatch(/"ownerSharePhp"/);
    expect(D.scoreboardText(d)).toMatch(/OWNER's share/);
    expect(D.scoreboardText(d)).not.toMatch(/\bcuts\b/);
  });
});
