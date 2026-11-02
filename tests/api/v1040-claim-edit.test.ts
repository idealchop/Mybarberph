import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.40 (Jimboy: "It's not reflecting when editing the amount... it must update immediately once save").
// In-memory only; nothing touches a real DB.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const { remitSummary, saveClaimAdjust, claimRemit } = await import("@/lib/server/remit");
const { claimStates } = await import("@/lib/profit-claim");
const { profitWeek } = await import("@/lib/profit-report");
const { claimCells, withCellAdjustments } = await import("@/features/sales/claim-cells");
const { applyAdjustment } = await import("@/lib/claim-adjusts");

const chairs = [{ id: "c1", label: "Jery", barberId: "b-jery", barberName: "Jery Aranil", locationId: "home", sharePct: 30, shareSet: true }];
const day = "2026-11-02", t0 = Date.parse(`${day}T10:00:00+08:00`);
// One walk-in: ₱400, barber 30% → owner share ₱280 (the screenshot's Mon 280).
const visit = { id: "v1", status: "done", paid: true, payMethod: "cash", price: 40000, barberId: "b-jery", locationId: "home", createdAt: t0 - 60_000, completedAt: t0, updatedAt: t0 };
function seed(shop: string) {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store[`shops/${shop}`] = { name: shop };
  fs.store[`shops/${shop}/private/chairs`] = { json: JSON.stringify(chairs) };
  fs.store[`shops/${shop}/bookings/v1`] = { ...visit };
}
const grid = (remit: Awaited<ReturnType<typeof remitSummary>> | null, rows = [visit]) => {
  const claimed = new Set((remit?.claims ?? []).flatMap((c) => c.bookingIds ?? []));
  const map = claimStates(rows, chairs, (r) => claimed.has(r.id));
  const w = profitWeek(rows, chairs, "all", 0, t0 + 3600_000, [{ id: "home", name: "Main" }]);
  return withCellAdjustments(w, claimCells(remit as never, rows, chairs, map), w.days.map((d) => d.key));
};
const mon = (g: ReturnType<typeof grid>) => g.rows[0]!.days[0];

describe("v1.0.40 To claim edit shows everywhere", () => {
  it("BUG repro: the records alone show 280 after the owner saved 500", () => {
    // Before the fix the saved amount lived only in the open day sheet; the grid was computed from the records.
    expect(mon(grid(null))).toBe(28000);
  });

  it("1 haircut (₱280 due) saved as ₱500: no cap; grid cell, row total, week total and To Claim show exactly 500", async () => {
    seed("s1");
    const a = await saveClaimAdjust("s1", "b-jery", "home", day, 50000);
    expect(a).toMatchObject({ expected: 28000, received: 50000 });
    const r = await remitSummary("s1", "all");
    expect(r.ownerTotal).toBe(50000);
    expect(r.unclaimed[0]!.ownerShare).toBe(50000);
    const g = grid(r);
    expect(mon(g)).toBe(50000);
    expect(g.rows[0]!.total).toBe(50000);
    expect(g.rows[0]!.adjusted?.[0]).toBe(true);
    expect(g.total).toBe(50000);
  });

  it("a lower amount works too, and saving the records' amount removes the edit", async () => {
    seed("s2");
    await saveClaimAdjust("s2", "b-jery", "home", day, 20000);
    expect((await remitSummary("s2", "all")).ownerTotal).toBe(20000);
    expect(await saveClaimAdjust("s2", "b-jery", "home", day, 28000)).toBeNull();
    const r = await remitSummary("s2", "all");
    expect(r.ownerTotal).toBe(28000);
    expect(mon(grid(r))).toBe(28000);
  });

  it("claiming the day uses the saved amount, removes the edit, and the claimed cell still shows 500", async () => {
    seed("s3");
    await saveClaimAdjust("s3", "b-jery", "home", day, 50000);
    const c = await claimRemit("s3", "b-jery", "home", "owner", day);
    expect(c).toMatchObject({ adjusted: true, expected: 28000, received: 50000 });
    expect(Object.keys(fs.store).some((k) => k.includes("/claimAdjusts/"))).toBe(false);
    const r = await remitSummary("s3", "all");
    expect(r.ownerTotal).toBe(0);
    expect(mon(grid(r))).toBe(50000);
  });

  it("v1.0.41: another haircut that day (or this phone's list lagging the server) still shows exactly the saved 500", async () => {
    seed("s4");
    await saveClaimAdjust("s4", "b-jery", "home", day, 50000);
    const v2 = { ...visit, id: "v2", completedAt: t0 + 3600_000, updatedAt: t0 + 3600_000 };
    fs.store["shops/s4/bookings/v2"] = v2;
    await claimRemit("s4", "b-jery", "home", "x", "2026-01-01").catch(() => undefined); // forces a fresh server read
    const r = await remitSummary("s4", "all");
    expect(r.ownerTotal).toBe(50000);
    expect(r.adjusts[0]).toMatchObject({ expected: 56000, received: 50000 });
    // Server has 2 haircuts, this phone still only 1 (lagging list): the grid shows 500 either way.
    expect(mon(grid(r, [visit, v2]))).toBe(50000);
    expect(mon(grid(r, [visit]))).toBe(50000);
  });
});

describe("v1.0.40 optimistic edit (client)", () => {
  const base = { unclaimed: [{ barberId: "b-jery", locationId: "home", amount: 40000, ownerShare: 28000 }], total: 40000, ownerTotal: 28000, claims: [], adjusts: [] };
  const a = { barberId: "b-jery", locationId: "home", day, expected: 28000, received: 50000, at: 1 };
  it("moves To Claim at once, is idempotent (a refetch re-applying it doesn't double it) and reverts", () => {
    const on = applyAdjustment(base, a, "all");
    expect(on.ownerTotal).toBe(50000);
    expect(applyAdjustment(on, a, "all").ownerTotal).toBe(50000);
    const back = applyAdjustment(on, { ...a, received: a.expected }, "all");
    expect(back.ownerTotal).toBe(28000);
    expect(back.adjusts).toEqual([]);
    expect(applyAdjustment(base, a, "other-branch")).toBe(base);
  });
  it("a fresh server copy that already has the edit is not changed by the pending re-apply (even if its records differ)", () => {
    const server = { ...base, ownerTotal: 50000, unclaimed: [{ ...base.unclaimed[0]!, ownerShare: 50000 }], adjusts: [a] };
    expect(applyAdjustment(server, a, "all")).toBe(server);
    const other = { ...server, adjusts: [{ ...a, expected: 56000 }] };
    expect(applyAdjustment(other, a, "all")).toBe(other);
  });
});
