import { describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.41 audit of the To claim / claimed amount edit (Jimboy: "any bugs about that amount update"). In-memory only.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("server-only", () => ({}));
const { remitSummary, saveClaimAdjust, claimRemit } = await import("@/lib/server/remit");
const { claimStates } = await import("@/lib/profit-claim");
const { profitWeek, compactPeso } = await import("@/lib/profit-report");
const { claimCells, withCellAdjustments } = await import("@/features/sales/claim-cells");
const { applyAdjustment, claimDayDelta, editClaimedDay, withDayDeltas } = await import("@/lib/claim-adjusts");
const { claimAdjust, claimInputText, claimedValue, parseClaimCentavos } = await import("@/lib/claim-adjust");
const { applyPendingClaim } = await import("@/lib/remit-optimistic");

const chairs = [
  { id: "c1", label: "Jery", barberId: "b-jery", barberName: "Jery", locationId: "home", sharePct: 30, shareSet: true },
  { id: "c2", label: "Mark", barberId: "b-mark", barberName: "Mark", locationId: "home", sharePct: 40, shareSet: true },
];
const mon = "2026-11-02", tue = "2026-11-03";
const at = (d: string, h = 10) => Date.parse(`${d}T${String(h).padStart(2, "0")}:00:00+08:00`);
const v = (id: string, barberId: string, d: string, price = 40000, h = 10) => ({ id, status: "done", paid: true, payMethod: "cash", price, barberId, locationId: "home", createdAt: at(d, h) - 60_000, completedAt: at(d, h), updatedAt: at(d, h) });
function seed(shop: string, rows: ReturnType<typeof v>[]) {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store[`shops/${shop}`] = { name: shop };
  fs.store[`shops/${shop}/private/chairs`] = { json: JSON.stringify(chairs) };
  for (const r of rows) fs.store[`shops/${shop}/bookings/${r.id}`] = r;
}
type R = Awaited<ReturnType<typeof remitSummary>>;
const grid = (remit: R, rows: ReturnType<typeof v>[]) => {
  const claimed = new Set(remit.claims.flatMap((c) => c.bookingIds ?? []));
  const map = claimStates(rows, chairs, (r) => claimed.has(r.id));
  const w = profitWeek(rows, chairs, "all", 0, at(tue, 20), [{ id: "home", name: "Main" }]);
  return withCellAdjustments(w, claimCells(remit as never, rows, chairs, map), w.days.map((d) => d.key));
};
const cell = (g: ReturnType<typeof grid>, barber: string, i: number) => g.rows.find((r) => r.id === barber)!.days[i];

describe("edit then claim, and editing claimed days (v1.0.41)", () => {
  it("edit 280 → 500, claim: the claim uses 500 with the Adjusted note, kept on that day", async () => {
    const rows = [v("j1", "b-jery", mon)]; seed("a1", rows);
    await saveClaimAdjust("a1", "b-jery", "home", mon, 50000);
    const c = await claimRemit("a1", "b-jery", "home", "o", mon);
    expect(c).toMatchObject({ adjusted: true, expected: 28000, received: 50000, dayDeltas: { [mon]: 22000 } });
    const r = await remitSummary("a1", "all");
    expect(cell(grid(r, rows), "b-jery", 0)).toBe(50000);
    expect(claimedValue(r.claims[0]!)).toBe(50000);
  });

  it("a claimed day can be edited (any amount, higher than the records): claim, grid, claimed figure update", async () => {
    const rows = [v("j1", "b-jery", mon)]; seed("a2", rows);
    await claimRemit("a2", "b-jery", "home", "o", mon);
    const res = await saveClaimAdjust("a2", "b-jery", "home", mon, 75000);
    expect(res && "claims" in res ? res.claims[0] : null).toMatchObject({ adjusted: true, expected: 28000, received: 75000, dayDeltas: { [mon]: 47000 } });
    const r = await remitSummary("a2", "all");
    expect(r.ownerTotal).toBe(0);
    expect(claimedValue(r.claims[0]!)).toBe(75000);
    expect(cell(grid(r, rows), "b-jery", 0)).toBe(75000);
  });

  it("editing a claimed day twice, then back to the records' amount clears 'Adjusted'", async () => {
    const rows = [v("j1", "b-jery", mon)]; seed("a3", rows);
    await claimRemit("a3", "b-jery", "home", "o", mon);
    await saveClaimAdjust("a3", "b-jery", "home", mon, 30000);
    await saveClaimAdjust("a3", "b-jery", "home", mon, 35000);
    expect(claimedValue((await remitSummary("a3", "all")).claims[0]!)).toBe(35000);
    await saveClaimAdjust("a3", "b-jery", "home", mon, 28000);
    const c = (await remitSummary("a3", "all")).claims[0]!;
    expect(c.adjusted).toBeUndefined();
    expect(claimedValue(c)).toBe(28000);
  });

  it("a whole-week claim edited on one day changes only that day's cell", async () => {
    const rows = [v("j1", "b-jery", mon), v("j2", "b-jery", tue)]; seed("a4", rows);
    await claimRemit("a4", "b-jery", "home", "o"); // no day: both days in one claim
    await saveClaimAdjust("a4", "b-jery", "home", tue, 10000);
    const r = await remitSummary("a4", "all");
    const g = grid(r, rows);
    expect([cell(g, "b-jery", 0), cell(g, "b-jery", 1)]).toEqual([28000, 10000]);
    expect(g.rows.find((x) => x.id === "b-jery")!.total).toBe(38000);
    expect(claimedValue(r.claims[0]!)).toBe(38000);
  });

  it("different barbers and days never pick up each other's edit", async () => {
    const rows = [v("j1", "b-jery", mon), v("m1", "b-mark", mon, 25000), v("j2", "b-jery", tue)]; seed("a5", rows);
    await saveClaimAdjust("a5", "b-jery", "home", mon, 50000);
    const g = grid(await remitSummary("a5", "all"), rows);
    expect(cell(g, "b-jery", 0)).toBe(50000);
    expect(cell(g, "b-mark", 0)).toBe(15000);
    expect(cell(g, "b-jery", 1)).toBe(28000);
    expect(g.daily[0]).toBe(65000);
    expect(g.total).toBe(50000 + 15000 + 28000);
  });

  it("an empty day has nothing to edit (the server says so)", async () => {
    seed("a6", [v("j1", "b-jery", mon)]);
    await expect(saveClaimAdjust("a6", "b-jery", "home", tue, 10000)).rejects.toThrow(/Nothing to claim/);
  });
});

describe("client side (optimistic, prefill, formatting)", () => {
  const base = { unclaimed: [{ barberId: "b-jery", locationId: "home", amount: 40000, ownerShare: 28000 }], total: 40000, ownerTotal: 28000, claims: [], adjusts: [] };
  it("prefill = the shown amount: saved edit if any, else the records; after a 2nd edit the 2nd value", () => {
    expect(claimAdjust(28000, undefined).received).toBe(28000);
    const one = applyAdjustment(base, { barberId: "b-jery", locationId: "home", day: mon, expected: 28000, received: 50000, at: 1 }, "all");
    expect(claimAdjust(28000, one.adjusts[0]!.received).received).toBe(50000);
    const two = applyAdjustment(one, { barberId: "b-jery", locationId: "home", day: mon, expected: 28000, received: 61000, at: 2 }, "all");
    expect(two.adjusts).toHaveLength(1);
    expect(two.ownerTotal).toBe(61000);
    expect(claimInputText(two.adjusts[0]!.received)).toBe("610");
  });
  it("optimistic day claim after an edit carries the day's change", () => {
    const d = applyPendingClaim(base as never, { id: "pending:1", barberId: "b-jery", locationId: "home", bookingIds: ["j1"], day: mon, at: 1, expected: 28000, received: 50000 }, "all");
    expect(d.claims[0]).toMatchObject({ adjusted: true, dayDeltas: { [mon]: 22000 } });
  });
  it("editClaimedDay / claimDayDelta: per-day, older adjusted claims keep their difference on their first day", () => {
    const legacy = { id: "c", amount: 40000, ownerShare: 28000, expected: 28000, received: 30000, adjusted: true };
    expect(claimDayDelta(legacy, mon, mon)).toBe(2000);
    expect(claimDayDelta(legacy, tue, mon)).toBe(0);
    const [e] = editClaimedDay([legacy], new Map([["c", 28000]]), mon, 45000, () => mon);
    expect(e).toMatchObject({ received: 45000, dayDeltas: { [mon]: 17000 }, adjusted: true });
    expect(withDayDeltas(e!, { [mon]: 0 }).adjusted).toBeUndefined();
  });
  it("amount input formats: ₱, commas, decimals; grid k abbreviations", () => {
    expect(parseClaimCentavos("1,500")).toBe(150000);
    expect(parseClaimCentavos("₱1,500.50")).toBe(150050);
    expect(parseClaimCentavos("500")).toBe(50000);
    expect(parseClaimCentavos("")).toBeNull();
    expect(parseClaimCentavos("abc")).toBeNull();
    expect(claimInputText(150050)).toBe("1500.50");
    expect([compactPeso(50000), compactPeso(150000), compactPeso(1250000)]).toEqual(["500", "1.5k", "13k"]);
  });
});
