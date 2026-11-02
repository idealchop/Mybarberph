/**
 * v1.0.40 saved "To claim" edits (Jimboy: "it must update immediately once save").
 * The owner can set a barber's day To claim to any amount (more or less than the records; never capped).
 * Before the claim it is saved as an adjustment for that barber + branch + day; once claimed, the claim keeps it.
 * Every view shows exactly the saved amount: grid cell, row total, chart, barber page, day sheet and Home To Claim.
 * v1.0.41: the saved amount IS that day's To claim while the day has unclaimed haircuts, whatever the records
 * add up to on this phone or on the server right now. (v1.0.40 dropped the edit whenever the records' total
 * differed from the total it was saved against, e.g. this phone's list was a few seconds behind the server or a
 * barber finished another haircut, so it only showed again after a full refresh.)
 */
export interface ClaimAdjustment { barberId: string; locationId: string; day: string; expected: number; received: number; at: number }

export const adjustKey = (barberId: string, locationId: string, day: string) => `${barberId}@${locationId}|${day}`;
/** Firestore doc id for an adjustment (no "/"). */
export const adjustDocId = (barberId: string, locationId: string, day: string) => encodeURIComponent(adjustKey(barberId, locationId, day)).replace(/\./g, "%2E");

/** Same amount within half a centavo (shares can be fractional). */
export const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** Is a saved adjustment in force? Yes while the day still has unclaimed money (any amount, never capped). */
export function adjustmentApplies(_a: Pick<ClaimAdjustment, "expected">, openOwner: number) {
  return openOwner > 0;
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
  // Same saved amount already there (e.g. a fresh server copy, whose `expected` comes from its own records): no-op.
  if (prev && !removing && sameAmount(prev.received, a.received)) return d;
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
  claims: { id: string; barberId?: string; locationId?: string; adjusted?: boolean; expected?: number; received?: number; bookingIds?: string[]; dayDeltas?: Record<string, number> }[] | undefined,
  openOwnerOf: (key: string) => number,
  cellOfBooking: (id: string) => string | null,
): Map<string, { delta: number }> {
  const m = new Map<string, { delta: number }>();
  const add = (k: string, d: number) => { const v = m.get(k); m.set(k, { delta: (v?.delta ?? 0) + d }); };
  for (const a of adjusts ?? []) {
    const k = adjustKey(a.barberId, a.locationId, a.day);
    const open = openOwnerOf(k);
    // The cell's open part shows exactly the saved amount (computed against this view's own records).
    if (adjustmentApplies(a, open)) add(k, a.received - open);
  }
  for (const c of claims ?? []) {
    // v1.0.41: per-day changes (edited claimed days, new adjusted day claims) sit on their own day.
    if (c.dayDeltas && c.barberId) { for (const [d, v] of Object.entries(c.dayDeltas)) add(adjustKey(c.barberId, c.locationId || "home", d), v); continue; }
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

/* ---- v1.0.41: claimed days are editable too ---- */
export type ClaimLike = { id: string; amount: number; ownerShare?: number; expected?: number; received?: number; adjusted?: boolean; difference?: number; bookingIds?: string[]; coveredIds?: string[]; dayDeltas?: Record<string, number> };

/**
 * The amount a claim adds to one day on top of that day's records. New claims keep it per day (`dayDeltas`);
 * older adjusted claims (v1.0.34–40, one day each) put their whole difference on `legacyDay`.
 */
export function claimDayDelta(c: ClaimLike, day: string, legacyDay?: string | null): number {
  if (c.dayDeltas) return c.dayDeltas[day] ?? 0;
  if (c.adjusted && typeof c.received === "number" && typeof c.expected === "number" && legacyDay === day) return c.received - c.expected;
  return 0;
}

/** The claim with its per-day changes made consistent: received = expected + Σ dayDeltas; `adjusted` only when they differ. */
export function withDayDeltas<C extends ClaimLike>(c: C, dayDeltas: Record<string, number>): C {
  const clean = Object.fromEntries(Object.entries(dayDeltas).filter(([, v]) => Math.abs(v) >= 0.5));
  const expected = c.expected ?? c.ownerShare ?? c.amount;
  const diff = Object.values(clean).reduce((s, v) => s + v, 0);
  const out = { ...c } as C;
  delete out.dayDeltas; delete out.adjusted; delete out.received; delete out.difference;
  if (!Object.keys(clean).length) return { ...out, expected } as C;
  return { ...out, expected, dayDeltas: clean, adjusted: true, received: expected + diff, difference: diff } as C;
}

/**
 * Edit a claimed day: make the day show `target` (centavos, any amount). `shares` = each covering claim's claimed
 * owner share ON THAT DAY from the records; `legacyDayOf` = the day an older adjusted claim's difference sits on.
 * The change is kept on the first claim; any other claim's change for that day is cleared. Returns changed claims.
 */
export function editClaimedDay<C extends ClaimLike>(claims: C[], shares: Map<string, number>, day: string, target: number, legacyDayOf: (c: C) => string | null = () => null): C[] {
  const cover = claims.filter((c) => shares.has(c.id));
  if (!cover.length) return [];
  const recordsTotal = cover.reduce((s, c) => s + (shares.get(c.id) ?? 0), 0);
  return cover.map((c, i) => {
    const base: Record<string, number> = c.dayDeltas ? { ...c.dayDeltas } : (() => { const d = legacyDayOf(c); return d ? { [d]: claimDayDelta(c, d, d) } : {}; })();
    base[day] = i === 0 ? target - recordsTotal : 0;
    return withDayDeltas(c, base);
  });
}
