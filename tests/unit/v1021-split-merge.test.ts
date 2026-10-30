import { describe, expect, it } from "vitest";
import { countToday, mergeLiveRows } from "@/lib/cut-count";
import { asOwnerSplit, barberPart, ownerPart } from "@/lib/split-view";
import { cellClaimState, claimStates } from "@/lib/profit-claim";

const NOW = Date.parse("2026-10-30T18:00:00+08:00");
const chairs = [{ id: "c1", barberId: "ray", locationId: "bayan", sharePct: 40, shareSet: true }, { id: "c2", barberId: "jun", locationId: "bayan" }];

describe("mismatch: owner merge must not hide cuts the barber sees", () => {
  const t = (h: number) => Date.parse(`2026-10-30T${String(h).padStart(2, "0")}:00:00+08:00`);
  const deep = [
    { id: "a", createdAt: t(9), updatedAt: t(10), completedAt: t(10), status: "done" },
    { id: "b", createdAt: t(11), updatedAt: t(12), completedAt: t(12), status: "done" }, // stale live says in_chair
    { id: "c", createdAt: t(15), updatedAt: t(16), completedAt: t(16), status: "done" }, // created after the stale live copy
  ];
  const staleLive = [
    { id: "a", createdAt: t(9), updatedAt: t(10), completedAt: t(10), status: "done" },
    { id: "b", createdAt: t(11), updatedAt: t(11), status: "in_chair" },
  ];
  it("newer server version wins and newer rows are kept (owner = barber)", () => {
    const merged = mergeLiveRows(deep, staleLive);
    expect(countToday(merged as never[], NOW)).toBe(3);
  });
  it("a live edit newer than the server still wins; a deleted row inside the live window drops", () => {
    const live = [{ id: "a", createdAt: t(9), updatedAt: t(17), completedAt: t(10), status: "cancelled" }, { id: "x", createdAt: t(13), updatedAt: t(13) }];
    const out = mergeLiveRows(deep, live);
    expect(out.find((r) => r.id === "a")?.status).toBe("cancelled");
    expect(out.some((r) => r.id === "b")).toBe(false); // created inside live's window but missing from live = deleted
    expect(out.some((r) => r.id === "c")).toBe(true);
  });
});

describe("split-only amounts", () => {
  it("owner part / barber part from the barber's profile share", () => {
    expect(ownerPart({ barberId: "ray", locationId: "bayan", price: 10000 }, chairs)).toBe(6000);
    expect(barberPart({ barberId: "ray", locationId: "bayan", price: 10000, tip: 2000 }, chairs)).toBe(6000);
    expect(ownerPart({ barberId: "jun", locationId: "bayan", price: 10000 }, chairs)).toBe(10000); // no split set
    expect(ownerPart({ barberId: "owner", price: 10000 }, chairs)).toBe(10000);
    expect(asOwnerSplit([{ barberId: "ray", locationId: "bayan", price: 10000, tip: 500 }], chairs)[0]).toMatchObject({ price: 6000, tip: undefined });
  });
});

describe("profit grid claim colors", () => {
  it("open → red, all claimed → green, GCash counts like cash (v1.0.25)", () => {
    const at = Date.parse("2026-10-30T10:00:00+08:00");
    const rows = [
      { id: "1", status: "done", paid: true, payMethod: "cash", price: 100, barberId: "ray", locationId: "bayan", completedAt: at },
      { id: "2", status: "done", paid: true, payMethod: "cash", price: 100, barberId: "ray", locationId: "bayan", completedAt: at + 86_400_000 },
      { id: "3", status: "done", paid: true, payMethod: "gcash", price: 100, barberId: "jun", locationId: "bayan", completedAt: at },
    ];
    const m = claimStates(rows, chairs, (r) => r.id === "2");
    expect(cellClaimState(m.get("ray@bayan|2026-10-30"))).toBe("open");
    expect(cellClaimState(m.get("ray@bayan|2026-10-31"))).toBe("claimed");
    expect(cellClaimState(m.get("jun@bayan|2026-10-30"))).toBe("open");
    expect(cellClaimState(claimStates(rows, chairs, () => true).get("jun@bayan|2026-10-30"))).toBe("claimed");
  });
});
