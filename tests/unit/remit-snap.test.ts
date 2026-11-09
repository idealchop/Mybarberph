import { describe, expect, it } from "vitest";
import { buildRemitSnap, mergeRemitSnap, poolOf, type SnapClaim, type SnapVisit } from "@/lib/remit-snap";

const oldVisit: SnapVisit = { id: "old", status: "done", paid: true, payMethod: "cash", price: 10000, barberId: "b-jery", locationId: "home", completedAt: Date.parse("2026-07-01T02:00:00Z"), updatedAt: Date.parse("2026-07-01T02:00:00Z"), createdAt: Date.parse("2026-07-01T01:00:00Z") };
const today: SnapVisit = { id: "today", status: "done", paid: true, payMethod: "cash", price: 40000, barberId: "b-jery", locationId: "home", completedAt: Date.parse("2026-11-09T02:00:00Z"), updatedAt: Date.parse("2026-11-09T02:00:00Z"), createdAt: Date.parse("2026-11-09T01:00:00Z") };
const ownerCut: SnapVisit = { ...today, id: "own", barberId: "owner" };

describe("remit snap", () => {
  it("keeps an old unclaimed visit and drops the owner's own cuts", () => {
    const snap = buildRemitSnap([oldVisit, today, ownerCut], []);
    expect(snap.pool.map((v) => v.id).sort()).toEqual(["old", "today"]);
    expect(poolOf([oldVisit], []).map((v) => v.id)).toEqual(["old"]);
  });

  it("a later visit does not drop the old unclaimed one; a claim removes only its own ids", () => {
    const snap = buildRemitSnap([oldVisit], []);
    const added = mergeRemitSnap(snap, [today], []);
    expect(added.changed).toBe(true);
    expect(added.snap.pool.map((v) => v.id).sort()).toEqual(["old", "today"]);
    const claim: SnapClaim = { id: "c1", barberId: "b-jery", locationId: "home", amount: 40000, bookingIds: ["today"], from: today.completedAt!, to: today.completedAt!, claimedAt: 180, claimedBy: "owner" };
    const claimed = mergeRemitSnap(added.snap, [], [claim]);
    expect(claimed.snap.pool.map((v) => v.id)).toEqual(["old"]);
    expect(claimed.snap.claims).toHaveLength(1);
    expect(mergeRemitSnap(claimed.snap, [], [])).toEqual({ snap: claimed.snap, changed: false });
  });

  it("an edit to a finished visit replaces that visit and leaves the other days", () => {
    const snap = buildRemitSnap([oldVisit, today], []);
    const edited = { ...today, price: 99000, updatedAt: 150 };
    const next = mergeRemitSnap(snap, [edited], []);
    expect(next.snap.pool.find((v) => v.id === "old")?.price).toBe(10000);
    expect(next.snap.pool.find((v) => v.id === "today")?.price).toBe(99000);
  });
});
