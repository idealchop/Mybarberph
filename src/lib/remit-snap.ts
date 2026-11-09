/**
 * Saved To Claim inputs. A poll reads this plus bookings and claims touched since `cursor`,
 * not every finished visit. The first read builds it. Old GCash coverage is applied on read
 * from `pool` and `claims`, so nothing stored on a visit changes.
 */
export const REMIT_SNAP_V = 1;

export type SnapVisit = {
  id: string;
  status?: string;
  paid?: boolean;
  payMethod?: string;
  price?: number;
  barberId?: string;
  barberName?: string;
  seatLabel?: string;
  chairLabel?: string;
  locationId?: string;
  completedAt?: number;
  updatedAt?: number;
  createdAt?: number;
  splitPct?: number | null;
};

export type SnapClaim = {
  id: string;
  barberId: string;
  barberName?: string;
  locationId: string;
  amount: number;
  bookingIds: string[];
  from: number;
  to: number;
  claimedAt: number;
  claimedBy?: string;
  ownerShare?: number;
  sharePct?: number | null;
  expected?: number;
  received?: number;
  adjusted?: boolean;
  difference?: number;
  rule?: number;
  dayDeltas?: Record<string, number>;
};

export type RemitSnap = {
  v: number;
  /** Next poll merges bookings with updatedAt >= cursor. 0 means the snap was never finished. */
  cursor: number;
  /** Next poll merges claims with claimedAt >= claimCursor. */
  claimCursor: number;
  /** Claimable visits not listed on a claim (includes GCash a legacy claim still covers). */
  pool: SnapVisit[];
  claims: SnapClaim[];
};

const claimable = (r: SnapVisit) => r.status === "done" && Boolean(r.paid) && (r.price || 0) > 0 && r.barberId !== "owner" && Boolean(r.id);

/** Visits that still need the claim rule. Already-listed ids are claimed and are not stored again. */
export function poolOf(done: SnapVisit[], claims: SnapClaim[]): SnapVisit[] {
  const ids = new Set(claims.flatMap((c) => c.bookingIds ?? []));
  const byId = new Map<string, SnapVisit>();
  for (const r of done) if (claimable(r) && !ids.has(r.id)) byId.set(r.id, r);
  return [...byId.values()];
}

const stamp = (r: { updatedAt?: number; completedAt?: number; createdAt?: number }) => r.updatedAt || r.completedAt || r.createdAt || 0;

export function buildRemitSnap(done: SnapVisit[], claims: SnapClaim[]): RemitSnap {
  // Cursors are the newest stamp already included. The next poll reads only newer stamps,
  // so a visit saved later is picked up even when its completedAt is older than the snap.
  const cursor = done.length ? Math.max(1, ...done.map(stamp)) : 1;
  const claimCursor = claims.length ? Math.max(1, ...claims.map((c) => c.claimedAt || 0)) : 1;
  return { v: REMIT_SNAP_V, cursor, claimCursor, pool: poolOf(done, claims), claims };
}

/**
 * Fold visits and claims written since the cursors into the snap.
 * `started` is the time the change queries began, so a write that lands during the read is picked up next poll.
 * Returns the same snap when nothing changed (the caller does not write).
 */
function sameVisit(a: SnapVisit, b: SnapVisit) {
  return a.price === b.price && a.status === b.status && a.paid === b.paid && a.payMethod === b.payMethod
    && a.barberId === b.barberId && a.locationId === b.locationId && a.completedAt === b.completedAt
    && a.updatedAt === b.updatedAt && a.splitPct === b.splitPct && a.barberName === b.barberName;
}

export function mergeRemitSnap(snap: RemitSnap, bookings: SnapVisit[], claims: SnapClaim[] = []): { snap: RemitSnap; changed: boolean } {
  if (!bookings.length && !claims.length) return { snap, changed: false };
  const byClaim = new Map(snap.claims.map((c) => [c.id, c]));
  for (const c of claims) if (c?.id) byClaim.set(c.id, { ...c, bookingIds: c.bookingIds ?? [] });
  const claimList = [...byClaim.values()];
  const listed = new Set(claimList.flatMap((c) => c.bookingIds ?? []));
  const pool = new Map(snap.pool.map((v) => [v.id, v]));
  for (const b of bookings) {
    if (!b?.id) continue;
    if (!claimable(b) || listed.has(b.id)) pool.delete(b.id);
    else pool.set(b.id, b);
  }
  for (const id of listed) pool.delete(id);
  const nextPool = [...pool.values()];
  const poolSame = nextPool.length === snap.pool.length && nextPool.every((v) => { const prev = snap.pool.find((p) => p.id === v.id); return !!prev && sameVisit(prev, v); });
  const claimUnchanged = claimList.length === snap.claims.length && claimList.every((c) => JSON.stringify(c) === JSON.stringify(snap.claims.find((p) => p.id === c.id)));
  if (poolSame && claimUnchanged) return { snap, changed: false };
  const cursor = Math.max(snap.cursor, ...bookings.map(stamp), 0);
  const claimCursor = Math.max(snap.claimCursor, ...claims.map((c) => c.claimedAt || 0), 0);
  return { snap: { v: REMIT_SNAP_V, cursor, claimCursor, pool: nextPool, claims: claimList }, changed: true };
}
