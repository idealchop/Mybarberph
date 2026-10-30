import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.25 (Jimboy: "even it's GCash, it should still add it on the total"). In-memory only; nothing touches a real DB.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({ verifyIdToken: async () => ({ uid: "x" }) }) }));
vi.mock("server-only", () => ({}));
const { remitSummary, claimedBookingIds } = await import("@/lib/server/remit");
const { dayClaim, claimStates, cellClaimState } = await import("@/lib/profit-claim");
const { ownerShareOf } = await import("@/lib/income-split");

const chairs = [{ id: "c1", label: "Raymond", barberId: "b-ray", barberName: "Raymond Diaz", locationId: "home", sharePct: 40, shareSet: true }];
const day = "2026-10-26", t0 = Date.parse(`${day}T09:00:00+08:00`);
// Mixed day: 5 cash + 2 GCash (like Raymond, Mon Oct 26).
const prices = [15000, 15000, 15000, 15000, 15000, 12500, 12500];
const mk = (shop: string) => prices.map((p, i) => ({ id: `${shop}-v${i}`, status: "done", paid: true, payMethod: i >= 5 ? "gcash" : "cash", price: p, barberId: "b-ray", locationId: "home", createdAt: t0 + i * 3600_000 - 60_000, completedAt: t0 + i * 3600_000, updatedAt: t0 + i * 3600_000 }));
const ownerAll = prices.reduce((s, p) => s + ownerShareOf(p, 40), 0);
function seed(shop: string, rows: Record<string, unknown>[], claims: Record<string, unknown>[] = []) {
  fs.store[`shops/${shop}`] = { name: shop };
  fs.store[`shops/${shop}/private/chairs`] = { json: JSON.stringify(chairs) };
  for (const r of rows) fs.store[`shops/${shop}/bookings/${r.id}`] = r;
  for (const c of claims) fs.store[`shops/${shop}/remitClaims/${c.id}`] = c;
}
const claimOfFrom = (s: Awaited<ReturnType<typeof remitSummary>>) => { const m = new Set(s.claims.flatMap((c) => [...c.bookingIds, ...(c.coveredIds ?? [])])); return (r: { id: string }) => m.has(r.id); };

describe("mixed cash/GCash day", () => {
  it("to claim includes GCash; a new claim lists GCash ids (rule 2) and the day turns fully claimed", async () => {
    const rows = mk("g1"); seed("g1", rows);
    vi.useFakeTimers({ toFake: ["Date"] });
    const before = await remitSummary("g1", "all");
    expect(before.unclaimed[0]).toMatchObject({ count: 7, ownerShare: ownerAll });
    expect(dayClaim(rows, chairs, "b-ray", "home", day, () => false).open).toBe(ownerAll);
    // The fake store has no transactions, so store the claim exactly as claimRemit builds it (rule 2, every paid id).
    fs.store["shops/g1/remitClaims/new"] = { id: "new", barberId: "b-ray", barberName: "Raymond", locationId: "home", amount: prices.reduce((a, b) => a + b, 0), ownerShare: ownerAll, bookingIds: rows.map((r) => r.id), from: t0, to: t0 + 6 * 3600_000, claimedAt: Date.now() + 99_000_000, claimedBy: "owner", rule: 2 };
    await new Promise((r) => setTimeout(r, 0)); vi.setSystemTime(Date.now() + 20_000); const after = await remitSummary("g1", "all"); vi.useRealTimers();
    expect(after.unclaimed).toEqual([]);
    const d = dayClaim(rows, chairs, "b-ray", "home", day, claimOfFrom(after));
    expect(d).toMatchObject({ open: 0, claimed: ownerAll, claimedCount: 7 });
    expect(cellClaimState(claimStates(rows, chairs, claimOfFrom(after)).get(`b-ray@home|${day}`))).toBe("claimed");
  });

  it("an older cash-only claim covers that day's GCash visits (no stored data changed, no double count)", async () => {
    const rows = mk("g2");
    const legacy = { id: "old", barberId: "b-ray", barberName: "Raymond", locationId: "home", amount: 75000, ownerShare: 5 * ownerShareOf(15000, 40), bookingIds: rows.slice(0, 5).map((r) => r.id), from: t0, to: t0 + 4 * 3600_000, claimedAt: t0 + 10 * 3600_000, claimedBy: "owner" };
    // A GCash visit recorded on that day AFTER the claim was made must stay open.
    const late = { ...rows[6]!, id: "g2-late", createdAt: t0 + 11 * 3600_000 };
    seed("g2", [...rows, late], [legacy]);
    const s = await remitSummary("g2", "all");
    expect(s.claims[0]!.coveredIds!.sort()).toEqual(["g2-v5", "g2-v6"]);
    expect(s.unclaimed[0]).toMatchObject({ count: 1, ownerShare: ownerShareOf(12500, 40) });
    const d = dayClaim([...rows, late], chairs, "b-ray", "home", day, claimOfFrom(s));
    expect(d.claimed).toBe(ownerAll); // all 7 original visits, cash + GCash, each counted once
    expect(d.open + d.claimed).toBe(ownerAll + ownerShareOf(12500, 40));
    expect(fs.store["shops/g2/remitClaims/old"]).toEqual(legacy); // stored claim untouched
    expect((await claimedBookingIds("g2")).has("g2-v6")).toBe(true); // locked for barber edits like cash
    expect((await claimedBookingIds("g2")).has("g2-late")).toBe(false);
  });
});
