/**
 * Optimistic claim (v1.0.30, Jimboy: "when i claim the money, I need to refresh before the color change").
 * A claim marks its haircuts claimed in every open remit view at once (green), and rolls back (red) if the
 * request fails. Pure functions so the rule is tested; the real figures always come from the refetch after.
 */
export interface OptUnclaimed { barberId: string; locationId: string; amount: number; ownerShare?: number; count: number }
export interface OptClaim { id: string; barberId: string; locationId: string; bookingIds?: string[]; amount: number; count: number; claimedAt: number; from: number; to: number; barberName: string; claimedBy: string; pending?: boolean }
export interface OptRemit<U extends OptUnclaimed = OptUnclaimed, C extends OptClaim = OptClaim> { unclaimed: U[]; total: number; ownerTotal?: number; claims: C[] }

export interface PendingClaim { id: string; barberId: string; locationId: string; bookingIds: string[]; day?: string; at: number }

export const PENDING_PREFIX = "pending:";

/** Does a remit scope ("all" or one location id) include this claim? */
export const inScope = (scope: string, locationId: string) => scope === "all" || scope === locationId;

/** Apply a pending claim: its booking ids count as claimed at once. A whole-barber claim (no day) also clears the barber's To Claim row. */
export function applyPendingClaim<R extends OptRemit>(d: R, p: PendingClaim, scope: string): R {
  if (!inScope(scope, p.locationId) || d.claims.some((c) => c.id === p.id)) return d;
  const claim = { id: p.id, barberId: p.barberId, locationId: p.locationId, bookingIds: p.bookingIds, amount: 0, count: p.bookingIds.length, claimedAt: p.at, from: p.at, to: p.at, barberName: "", claimedBy: "", pending: true } as unknown as R["claims"][number];
  let unclaimed = d.unclaimed, total = d.total, ownerTotal = d.ownerTotal;
  if (!p.day) {
    const hit = d.unclaimed.filter((u) => u.barberId === p.barberId && u.locationId === p.locationId);
    unclaimed = d.unclaimed.filter((u) => !hit.includes(u));
    total = Math.max(0, total - hit.reduce((s, u) => s + u.amount, 0));
    if (ownerTotal !== undefined) ownerTotal = Math.max(0, ownerTotal - hit.reduce((s, u) => s + (u.ownerShare ?? u.amount), 0));
  }
  return { ...d, unclaimed, total, ...(ownerTotal !== undefined ? { ownerTotal } : {}), claims: [...d.claims, claim] };
}

/** Undo a pending claim (request failed): the haircuts go back to red. */
export function rollbackPendingClaim<R extends OptRemit>(d: R, before: R | null, id: string): R {
  if (!d.claims.some((c) => c.id === id)) return d;
  const claims = d.claims.filter((c) => c.id !== id);
  // Restore the To Claim rows from the snapshot taken before the optimistic step, when we have it.
  return before ? { ...before, claims: [...before.claims.filter((c) => !c.pending), ...claims.filter((c) => c.pending)] } : { ...d, claims };
}
