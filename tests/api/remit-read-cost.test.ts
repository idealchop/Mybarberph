import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// To Claim after the snap: old unclaimed days stay, and an edited amount is not capped.
// In-memory only. Nothing touches a real database.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const { remitSummary, saveClaimAdjust } = await import("@/lib/server/remit");
const { ownerShareOf } = await import("@/lib/income-split");

const chairs = [{ id: "c1", label: "Jery", barberId: "b-jery", barberName: "Jery", locationId: "home", sharePct: 30, shareSet: true }];
const july = Date.parse("2026-07-01T02:00:00+08:00");
const todayAt = Date.parse("2026-11-09T02:00:00+08:00");
const today = "2026-11-09";
const visit = (id: string, at: number, price: number) => ({ id, status: "done", paid: true, payMethod: "cash", price, barberId: "b-jery", barberName: "Jery", locationId: "home", createdAt: at - 60_000, completedAt: at, updatedAt: at });

function seed() {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store["shops/s1"] = { name: "s1" };
  fs.store["shops/s1/private/chairs"] = { json: JSON.stringify(chairs) };
  fs.store["shops/s1/bookings/old"] = visit("old", july, 10000);
  fs.store["shops/s1/bookings/today"] = visit("today", todayAt, 40000);
}

describe("To Claim snap", () => {
  it("keeps a months-old unclaimed day, then an edit above the records, across a later poll", async () => {
    seed();
    vi.useFakeTimers();
    vi.setSystemTime(todayAt);
    const oldOwner = ownerShareOf(10000, 30);
    const todayOwner = ownerShareOf(40000, 30);
    const first = await remitSummary("s1", "all");
    expect(first.unclaimed[0]).toMatchObject({ count: 2, ownerShare: oldOwner + todayOwner });
    expect(fs.store["shops/s1/private/remitSnap"]).toBeTruthy();

    const saved = await saveClaimAdjust("s1", "b-jery", "home", today, 50000);
    expect(saved).toMatchObject({ expected: todayOwner, received: 50000 });

    vi.setSystemTime(todayAt + 20_000);
    fs.store["shops/s1/bookings/later"] = visit("later", todayAt + 5_000, 20000);
    const second = await remitSummary("s1", "all");
    // July is still there. The new cut is there. Today's saved 500 is not capped back to the records.
    expect(second.unclaimed[0]!.count).toBe(3);
    // The saved 500 replaces that whole Manila day (the original cut plus the new one). July stays on top, uncapped.
    expect(second.ownerTotal).toBe(oldOwner + 50000);
    expect(second.adjusts[0]).toMatchObject({ received: 50000 });
    const ids = JSON.parse((fs.store["shops/s1/private/remitSnap"] as { body: string }).body).pool.map((v: { id: string }) => v.id).sort();
    expect(ids).toEqual(["later", "old", "today"]);
    vi.useRealTimers();
  });
});
