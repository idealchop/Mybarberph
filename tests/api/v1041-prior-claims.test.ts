import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.41: prod screenshot (Jery Aranil, Niugan, Mon Nov 2 9:55 PM): header "₱2,940 · ₱2,100 to claim · ₱840 claimed"
// but the Mon row showed ₱2,940 all red. Cause: part of the day was claimed earlier. In-memory only (no prod).
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const { remitSummary, saveClaimAdjust, claimRemit } = await import("@/lib/server/remit");
const { claimStates, dayClaim } = await import("@/lib/profit-claim");
const { profitWeek } = await import("@/lib/profit-report");
const { claimCells, withCellAdjustments } = await import("@/features/sales/claim-cells");
const { barberWeekView, cellSplit } = await import("@/lib/profit-barber-week");
const { claimAdjust, claimedValue } = await import("@/lib/claim-adjust");

const chairs = [{ id: "c-jery-aranil", label: "Jery Aranil", barberId: "b-jery-aranil", barberName: "Jery Aranil", locationId: "loc-niugan", sharePct: 50, shareSet: true }];
const B = "b-jery-aranil", L = "loc-niugan", sun = "2026-11-01", mon = "2026-11-02";
const at = (d: string, m: number) => Date.parse(`${d}T09:00:00+08:00`) + m * 60_000;
const v = (id: string, d: string, m: number) => ({ id, status: "done", paid: true, payMethod: "cash", price: 14000, splitPct: 50, barberId: B, locationId: L, createdAt: at(d, m) - 60_000, completedAt: at(d, m), updatedAt: at(d, m) });
const rows: ReturnType<typeof v>[] = [];
const add = (r: ReturnType<typeof v>) => { rows.push(r); fs.store[`shops/s/bookings/${r.id}`] = r; };
fs.store["shops/s"] = { name: "Boyet" };
fs.store["shops/s/private/chairs"] = { json: JSON.stringify(chairs) };
const loc = [{ id: L, name: "Niugan" }];
async function view() {
  const remit = await remitSummary("s", "all");
  const claimed = new Set(remit.claims.flatMap((c) => c.bookingIds ?? []));
  const map = claimStates(rows, chairs, (r) => claimed.has(r.id));
  const raw = profitWeek(rows, chairs, "all", 0, at(mon, 13 * 60), loc);
  const cells = claimCells(remit as never, rows, chairs, map);
  const w = withCellAdjustments(raw, cells, raw.days.map((d) => d.key));
  const row = w.rows.find((r) => r.id === B)!;
  return { remit, map, cells, row, bw: barberWeekView(row, w.days, map, mon, cells), sheet: dayClaim(rows, chairs, B, L, mon, (r) => claimed.has(r.id)) };
}

describe("a day partly claimed earlier (prior claims)", () => {
  it("Sunday claimed, Monday 6 claimed in the morning + 15 open: Mon shows ₱1,050 to claim + ₱420 claimed", async () => {
    for (let i = 0; i < 4; i++) add(v(`s${i}`, sun, i * 20));
    await claimRemit("s", B, L, "owner"); // claim all (Sunday)
    for (let i = 0; i < 6; i++) add(v(`m${i}`, mon, i * 10));
    await claimRemit("s", B, L, "owner", mon); // Monday morning
    for (let i = 6; i < 21; i++) add(v(`m${i}`, mon, i * 10));
    const { bw, row, remit } = await view();
    const d = bw.days.find((x) => x.key === mon)!;
    expect(row.total).toBe(21 * 7000); // Sunday is the previous week
    expect(d).toMatchObject({ amount: 147000, toClaim: 105000, claimed: 42000, state: "mixed" });
    expect([bw.toClaim, bw.claimed]).toEqual([remit.ownerTotal, 42000]); // header = row parts
  });

  it("editing that day prefills only the To claim part and saves it without touching the claimed part", async () => {
    const before = await view();
    expect(claimAdjust(before.sheet.open, undefined).received).toBe(105000); // prefill: ₱1,050, not ₱1,470
    await saveClaimAdjust("s", B, L, mon, 150000);
    const { bw, remit } = await view();
    expect(remit.adjusts?.[0]).toMatchObject({ day: mon, received: 150000 });
    expect(bw.days.find((x) => x.key === mon)).toMatchObject({ amount: 192000, toClaim: 150000, claimed: 42000, state: "mixed" });
    expect(remit.ownerTotal).toBe(150000);
    expect(bw.toClaim).toBe(150000);
    // edit again (twice in a row)
    await saveClaimAdjust("s", B, L, mon, 120000);
    expect((await view()).bw.days.find((x) => x.key === mon)).toMatchObject({ toClaim: 120000, claimed: 42000 });
  });

  it("Claim all keeps the saved edit for that day; the day turns all claimed at the edited amount", async () => {
    const c = await claimRemit("s", B, L, "owner");
    expect(c).toMatchObject({ adjusted: true, dayDeltas: { [mon]: 120000 - 105000 }, received: 120000 });
    const { bw, remit } = await view();
    expect(remit.adjusts ?? []).toHaveLength(0);
    expect(bw.days.find((x) => x.key === mon)).toMatchObject({ amount: 162000, toClaim: 0, claimed: 162000, state: "claimed" });
  });

  it("editing the now fully claimed day with several claims (morning claim + claim all)", async () => {
    await saveClaimAdjust("s", B, L, mon, 200000);
    const { bw, remit } = await view();
    expect(bw.days.find((x) => x.key === mon)).toMatchObject({ amount: 200000, claimed: 200000, state: "claimed" });
    expect(claimedValue(remit.claims.find((c) => c.bookingIds?.includes("s0"))!)).toBe(28000); // the previous day is untouched
    expect(remit.claims.reduce((s, c) => s + claimedValue(c), 0)).toBe(228000);
  });

  it("cellSplit: open, claimed, mixed, edits on either part", () => {
    expect(cellSplit(0, undefined)).toEqual({ toClaim: 0, claimed: 0, state: null });
    expect(cellSplit(294000, { open: 30, claimed: 12, openOwner: 210000 })).toEqual({ toClaim: 210000, claimed: 84000, state: "mixed" });
    expect(cellSplit(28000, { open: 1, claimed: 0, openOwner: 28000 })).toMatchObject({ toClaim: 28000, claimed: 0, state: "open" });
    expect(cellSplit(50000, { open: 1, claimed: 0, openOwner: 28000 }, { delta: 22000, open: 22000, claimed: 0 })).toMatchObject({ toClaim: 50000, state: "open" });
    expect(cellSplit(40000, { open: 0, claimed: 2, openOwner: 0 }, { delta: 5000, open: 0, claimed: 5000 })).toMatchObject({ toClaim: 0, claimed: 40000, state: "claimed" });
  });
});
