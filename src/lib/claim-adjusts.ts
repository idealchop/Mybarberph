/**
 * v1.0.40 saved "To claim" edits (Jimboy: "it must update immediately once save").
 * The owner can set a barber's day To claim to any amount (more or less than the records; never capped).
 * Before the claim it is saved as an adjustment for that barber + branch + day; once claimed, the claim keeps it.
 * Every view shows exactly the saved amount: grid cell, row total, chart, barber page, day sheet and Home To Claim.
 * An adjustment counts only while the records still add up to the amount it was made against (`expected`);
 * if a haircut is added or changed afterwards, it no longer applies and the owner sees the records again.
 */
export interface ClaimAdjustment { barberId: string; locationId: string; day: string; expected: number; received: number; at: number }

export const adjustKey = (barberId: string, locationId: string, day: string) => `${barberId}@${locationId}|${day}`;
/** Firestore doc id for an adjustment (no "/"). */
export const adjustDocId = (barberId: string, locationId: string, day: string) => encodeURIComponent(adjustKey(barberId, locationId, day)).replace(/\./g, "%2E");

/** Same amount within half a centavo (shares can be fractional). */
export const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** Is a saved adjustment still in force for the day's open (unclaimed) owner share? */
export function adjustmentApplies(a: Pick<ClaimAdjustment, "expected">, openOwner: number) {
  return openOwner > 0 && sameAmount(a.expected, openOwner);
}

type Remitish = { unclaimed: { barberId: string; locationId: string; ownerShare?: number; amount: number }[]; ownerTotal?: number; total: number; adjusts?: ClaimAdjustment[] };

/**
 * Optimistic save: put (or replace / remove when received = expected) an adjustment in one remit scope.
 * To Claim figures move by the change in difference. Idempotent: applying the same adjustment twice is a no-op.
 */
export function applyAdjustment<R extends Remitish>(d: R, a: ClaimAdjustment, scope: string): R {
  if (scope !== "all" && scope !== a.locationId) return d;
  const k = adjustKey(a.barberId, a.locationId, a.day);
  const list = d.adjusts ?? [];
  const prev = list.find((x) => adjustKey(x.barberId, x.locationId, x.day) === k);
  const before = prev ? prev.received - prev.expected : 0;
  const removing = sameAmount(a.received, a.expected);
  const after = removing ? 0 : a.received - a.expected;
  if (prev && !removing && sameAmount(prev.received, a.received) && sameAmount(prev.expected, a.expected)) return d;
  if (!prev && removing) return d;
  const delta = after - before;
  const adjusts = [...list.filter((x) => x !== prev), ...(removing ? [] : [a])];
  let hit = false;
  const unclaimed = d.unclaimed.map((u) => {
    if (u.barberId !== a.barberId || u.locationId !== a.locationId) return u;
    hit = true;
    return { ...u, ownerShare: (u.ownerShare ?? u.amount) + delta };
  });
  return { ...d, adjusts, unclaimed: hit ? unclaimed : d.unclaimed, ...(d.ownerTotal !== undefined ? { ownerTotal: d.ownerTotal + delta } : {}) };
}

/**
 * Per cell (`barber@loc|day`) the amount to add to the records' owner share so the cell shows the saved amount:
 * open days with a saved adjustment, and claimed days whose claim was adjusted.
 */
export function cellAdjustments(
  adjusts: ClaimAdjustment[] | undefined,
  claims: { id: string; adjusted?: boolean; expected?: number; received?: number; bookingIds?: string[] }[] | undefined,
  openOwnerOf: (key: string) => number,
  cellOfBooking: (id: string) => string | null,
): Map<string, { delta: number }> {
  const m = new Map<string, { delta: number }>();
  const add = (k: string, d: number) => { const v = m.get(k); m.set(k, { delta: (v?.delta ?? 0) + d }); };
  for (const a of adjusts ?? []) {
    const k = adjustKey(a.barberId, a.locationId, a.day);
    if (adjustmentApplies(a, openOwnerOf(k))) add(k, a.received - a.expected);
  }
  for (const c of claims ?? []) {
    if (!c.adjusted || typeof c.expected !== "number" || typeof c.received !== "number") continue;
    const cell = (c.bookingIds ?? []).map(cellOfBooking).find(Boolean);
    if (cell) add(cell, c.received - c.expected);
  }
  return m;
}

type Grid = { rows: { id: string; locationId: string; days: number[]; total: number; adjusted?: boolean[] }[]; daily: number[]; total: number };

/** Applies cell adjustments to a week/month grid: cells, row totals, column totals, grand total. `colOf(day)` → column. */
export function withCellAdjustments<G extends Grid>(g: G, cells: Map<string, { delta: number }>, days: string[], colOf: (day: string) => number = (d) => days.indexOf(d)): G {
  if (!cells.size) return g;
  const daily = g.daily.slice();
  let total = g.total;
  const rows = g.rows.map((r) => {
    let days2: number[] | null = null, adjusted: boolean[] | null = null, rt = r.total;
    for (const [k, v] of cells) {
      const at = k.lastIndexOf("|");
      if (k.slice(0, at) !== `${r.id}@${r.locationId}`) continue;
      const i = colOf(k.slice(at + 1));
      if (i < 0 || i >= r.days.length) continue;
      days2 ??= r.days.slice(); adjusted ??= r.days.map(() => false);
      days2[i] = days2[i]! + v.delta; adjusted[i] = true; rt += v.delta; daily[i] = (daily[i] ?? 0) + v.delta; total += v.delta;
    }
    return days2 ? { ...r, days: days2, total: rt, adjusted: adjusted! } : r;
  });
  return { ...g, rows, daily, total };
}
