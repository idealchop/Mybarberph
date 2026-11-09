import { claimAdjust } from "@/lib/claim-adjust";
import { adjustDocId, adjustKey, adjustmentApplies, editClaimedDay, withDayDeltas, type ClaimAdjustment } from "@/lib/claim-adjusts";
import "server-only";
import { isOwnerCut } from "@/lib/owner-cut";
import { claimOwnerShare, ownerShareOf, sharePct, visitPct } from "@/lib/income-split";
import type { ChairRequest } from "@/lib/booking-types";
import { loadState, shopRef } from "./shops";
import { cutBarberId, cutBarberName } from "@/lib/cut-count";
import { CLAIM_RULE, claimIndex, isClaimable } from "@/lib/claim-rule";
import { buildRemitSnap, mergeRemitSnap, readRemitSnap, writeRemitSnap, type SnapClaim, type SnapVisit } from "./remit-snap";

type Chair = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string; sharePct?: number | null; shareSet?: boolean };
export interface RemitClaim { id: string; barberId: string; barberName: string; locationId: string; amount: number; bookingIds: string[]; from: number; to: number; claimedAt: number; claimedBy: string;
  /** Owner/shop share claimed (amount minus the barber's split; None = all). Older claims lack it and are computed on read. */ ownerShare?: number; sharePct?: number | null;
  /** Adjusted claim (v1.0.34): owner entered the actual amount received. expected = owner share due, difference = received − expected. */ expected?: number; received?: number; adjusted?: boolean; difference?: number;
  /** 2 = lists GCash visits too (v1.0.25). Older claims listed cash only (lib/claim-rule.ts). */ rule?: number;
  /** v1.0.41: amount added per Manila day on top of the records (edited claimed days); received = expected + Σ. */ dayDeltas?: Record<string, number> }
export interface Unclaimed { barberId: string; barberName: string; locationId: string; amount: number; ownerShare: number; count: number; oldest: number }

const HOME = "home";
const keyOf = (r: ChairRequest, chairs: Chair[]) => {
  const bl = r.locationId || HOME;
  return { id: cutBarberId(r, chairs), name: cutBarberName(r, chairs), loc: bl };
};
/** The barber's split % for a barber id at a location (chair id or barber id). */
const pctOf = (chairs: Chair[], id: string, loc: string) => {
  const c = chairs.find((x) => (x.barberId === id || x.id === id) && (x.locationId || HOME) === loc) ?? chairs.find((x) => x.barberId === id || x.id === id);
  return c ? sharePct(c) : null;
};
/** Claimable = done, paid, with a price; cash AND GCash (v1.0.25, lib/claim-rule.ts). */
const isCash = (r: ChairRequest) => isClaimable(r);

// Per-instance cache: Home, Sales and History all ask for the same summary; a claim or edit clears it.
// 15s matches the client's pending-edit hold (use-remit.ts). The snap below is what skips the history scan.
const cache = new Map<string, { at: number; data: Promise<Awaited<ReturnType<typeof loadFresh>>> }>();
function load(shopId: string, fresh = false) {
  if (fresh) cache.delete(shopId);
  const hit = cache.get(shopId);
  if (!fresh && hit && Date.now() - hit.at < 15_000) return hit.data;
  const data = fresh ? loadFresh(shopId) : loadFast(shopId);
  cache.set(shopId, { at: Date.now(), data });
  data.catch(() => cache.delete(shopId));
  return data;
}

const REMIT_FIELDS = ["id", "status", "paid", "payMethod", "price", "barberId", "barberName", "seatLabel", "chairLabel", "locationId", "completedAt", "updatedAt", "createdAt", "splitPct"] as const;

type RemitLoaded = {
  chairs: Chair[];
  claims: RemitClaim[];
  open: ChairRequest[];
  claimed: Set<string>;
  covered: Map<string, string[]>;
  adjusts: ClaimAdjustment[];
  done: ChairRequest[];
};

function asVisit(d: { id: string; data: () => unknown }): ChairRequest {
  const raw = d.data() as ChairRequest;
  return { ...raw, id: raw?.id || d.id };
}

/** Same totals as a full history scan: listed ids plus legacy GCash days, then whatever is still open. */
function settle(done: ChairRequest[], claims: RemitClaim[], chairs: Chair[], adjusts: ClaimAdjustment[]): RemitLoaded {
  const covers = claimIndex(claims, chairs);
  const claimed = new Set(claims.flatMap((c) => c.bookingIds));
  const covered = new Map<string, string[]>();
  for (const r of done) { if (!isCash(r) || claimed.has(r.id)) continue; const c = covers(r); if (c) { claimed.add(r.id); covered.set(c.id, [...(covered.get(c.id) ?? []), r.id]); } }
  const open = done.filter((r) => isCash(r) && !claimed.has(r.id) && !isOwnerCut(r));
  return { chairs, claims, open, claimed, covered, adjusts, done };
}

/** One full read of every finished visit and every claim. Used to build the snap, and on Save / Claim so money edits cannot drift. */
async function loadFresh(shopId: string): Promise<RemitLoaded> {
  const [claimsSnap, doneSnap, state, adjustSnap] = await Promise.all([
    // Every claim (v1.0.24): with a 500 cap, older claims fell off and their visits looked unclaimed again.
    shopRef(shopId).collection("remitClaims").orderBy("claimedAt", "desc").get(),
    // No cap (v1.0.24): an unordered 8,000 cap dropped arbitrary visits from To Claim. This full read runs when the
    // snap is missing or when the owner saves/claims, not on the 30s poll.
    shopRef(shopId).collection("bookings").where("status", "==", "done").select(...REMIT_FIELDS).get(),
    loadState(shopId, ["barbers.shop-chairs"]),
    shopRef(shopId).collection("claimAdjusts").get(),
  ]);
  const adjusts = adjustSnap.docs.map((d) => d.data() as ClaimAdjustment);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const claims = claimsSnap.docs.map((d) => ({ ...(d.data() as RemitClaim), id: (d.data() as RemitClaim).id || d.id }));
  const done = doneSnap.docs.map(asVisit);
  const settled = settle(done, claims, chairs, adjusts);
  await writeRemitSnap(shopId, buildRemitSnap(done, claims)).catch((e) => console.error("[remit-snap] write failed", (e as Error).message));
  return settled;
}

/**
 * Poll path. Reads the snap plus visits/claims changed since it was built.
 * Old unclaimed days stay in the snap, so they are not re-read and cannot fall off.
 */
async function loadFast(shopId: string): Promise<RemitLoaded> {
  const stored = await readRemitSnap(shopId);
  if (!stored) return loadFresh(shopId);
  const [bookSnap, claimSnap, state, adjustSnap] = await Promise.all([
    shopRef(shopId).collection("bookings").where("updatedAt", ">", stored.cursor).select(...REMIT_FIELDS).get(),
    shopRef(shopId).collection("remitClaims").where("claimedAt", ">", stored.claimCursor).get(),
    loadState(shopId, ["barbers.shop-chairs"]),
    shopRef(shopId).collection("claimAdjusts").get(),
  ]);
  const bookings = bookSnap.docs.map(asVisit);
  const changedClaims = claimSnap.docs.map((d) => ({ ...(d.data() as RemitClaim), id: (d.data() as RemitClaim).id || d.id }));
  const merged = mergeRemitSnap(stored, bookings as SnapVisit[], changedClaims as SnapClaim[]);
  if (merged.changed) await writeRemitSnap(shopId, merged.snap).catch((e) => console.error("[remit-snap] write failed", (e as Error).message));
  const snap = merged.snap;
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const adjusts = adjustSnap.docs.map((d) => d.data() as ClaimAdjustment);
  // `done` here is the open pool (listed visits are on the claims). Save/Claim call loadFresh and see every visit.
  return settle(snap.pool as ChairRequest[], snap.claims as RemitClaim[], chairs, adjusts);
}

const manilaDay = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
/** Open (unclaimed) owner share per `barber@loc|day`. */
function openByDay(open: ChairRequest[], chairs: Chair[]) {
  const m = new Map<string, number>();
  for (const r of open) {
    const k = keyOf(r, chairs);
    const key = adjustKey(k.id, k.loc, manilaDay(r.completedAt ?? r.updatedAt ?? 0));
    m.set(key, (m.get(key) ?? 0) + ownerShareOf(r.price || 0, visitPct(r, pctOf(chairs, k.id, k.loc))));
  }
  return m;
}

/**
 * v1.0.40: owner saves a barber's day To claim amount (any amount, more or less than the records; never capped).
 * `expected` is the day's open owner share now (from the server's records). received = expected removes the edit.
 */
export async function saveClaimAdjust(shopId: string, barberId: string, locationId: string, day: string, received: number): Promise<ClaimAdjustment | { claims: RemitClaim[] } | null> {
  const { chairs, open } = await load(shopId, true);
  const expected = openByDay(open, chairs).get(adjustKey(barberId, locationId, day)) ?? 0;
  // v1.0.41: a fully claimed day is editable too: the change is kept on its claim.
  if (expected <= 0) return { claims: await editClaimed(shopId, barberId, locationId, day, received) };
  const ref = shopRef(shopId).collection("claimAdjusts").doc(adjustDocId(barberId, locationId, day));
  cache.delete(shopId);
  if (Math.abs(received - expected) < 0.5) { await ref.delete(); return null; }
  const a: ClaimAdjustment = { barberId, locationId, day, expected, received, at: Date.now() };
  await ref.set(a);
  return a;
}

/** Ids of every visit the owner already claimed (locked for barber edits). */
export async function claimedBookingIds(shopId: string): Promise<Set<string>> {
  const { claimed } = await load(shopId);
  return claimed;
}

/** Claimed owner share per claim on one barber's day, and the day an older adjusted claim's difference sits on. */
function claimedDayShares(done: ChairRequest[], claims: RemitClaim[], covered: Map<string, string[]>, chairs: Chair[], barberId: string, locationId: string, day: string) {
  const owner = new Map<string, string>();
  for (const c of claims) { for (const id of c.bookingIds) owner.set(id, c.id); for (const id of covered.get(c.id) ?? []) owner.set(id, c.id); }
  const shares = new Map<string, number>();
  const firstDay = new Map<string, { at: number; day: string }>();
  for (const r of done) {
    const cid = owner.get(r.id); if (!cid || !isCash(r)) continue;
    const k = keyOf(r, chairs), at = r.completedAt ?? r.updatedAt ?? 0, d = manilaDay(at);
    const f = firstDay.get(cid); if (!f || at < f.at) firstDay.set(cid, { at, day: d });
    if (k.id !== barberId || k.loc !== locationId || d !== day) continue;
    shares.set(cid, (shares.get(cid) ?? 0) + ownerShareOf(r.price || 0, visitPct(r, pctOf(chairs, k.id, k.loc))));
  }
  return { shares, legacyDay: (c: RemitClaim) => firstDay.get(c.id)?.day ?? null };
}

async function editClaimed(shopId: string, barberId: string, locationId: string, day: string, received: number): Promise<RemitClaim[]> {
  const { chairs, claims, covered, done } = await load(shopId, true);
  const { shares, legacyDay } = claimedDayShares(done, claims, covered, chairs, barberId, locationId, day);
  const changed = editClaimedDay(claims, shares, day, received, legacyDay);
  if (!changed.length) throw new Error("Nothing to claim for this day.");
  const col = shopRef(shopId).collection("remitClaims");
  for (const c of changed) await col.doc(c.id).set(c);
  cache.delete(shopId);
  // The claim's claimedAt does not change, so the poll query would not see this edit. Write it into the snap.
  const snap = await readRemitSnap(shopId);
  if (snap) {
    const byId = new Map(snap.claims.map((c) => [c.id, c]));
    for (const c of changed) byId.set(c.id, c);
    await writeRemitSnap(shopId, { ...snap, claims: [...byId.values()] });
  }
  return changed;
}

/** Unclaimed remit per barber (all time, up to now) and recent claims. `loc` = location id or "all". */
export async function remitSummary(shopId: string, loc: string) {
  const { chairs, claims, open, covered, adjusts } = await load(shopId);
  const map = new Map<string, Unclaimed>();
  const byDay = openByDay(open, chairs);
  // Saved To claim edits still matching the day's records (v1.0.40).
  // v1.0.41: `expected` is the day's records now, so every view adds exactly received − expected.
  const live = adjusts
    .map((a) => ({ ...a, expected: byDay.get(adjustKey(a.barberId, a.locationId, a.day)) ?? 0 }))
    .filter((a) => (loc === "all" || a.locationId === loc) && adjustmentApplies(a, a.expected));
  for (const r of open) {
    const k = keyOf(r, chairs);
    if (loc !== "all" && k.loc !== loc) continue;
    const id = `${k.id}@${k.loc}`;
    const u = map.get(id) ?? { barberId: k.id, barberName: k.name, locationId: k.loc, amount: 0, ownerShare: 0, count: 0, oldest: Date.now() };
    u.amount += r.price || 0; u.ownerShare += ownerShareOf(r.price || 0, visitPct(r, pctOf(chairs, k.id, k.loc))); u.count += 1; u.oldest = Math.min(u.oldest, r.completedAt ?? r.updatedAt ?? Date.now());
    map.set(id, u);
  }
  for (const a of live) { const u = map.get(`${a.barberId}@${a.locationId}`); if (u) u.ownerShare += a.received - a.expected; }
  const unclaimed = [...map.values()].sort((a, b) => b.ownerShare - a.ownerShare);
  return {
    adjusts: live,
    unclaimed, total: unclaimed.reduce((s, u) => s + u.amount, 0), ownerTotal: unclaimed.reduce((s, u) => s + u.ownerShare, 0),
    // v1.0.24: no 100-claim cap. The client marks claimed visits from this list, so a cap turned old claimed days red again.
    claims: claims.filter((c) => (loc === "all" || c.locationId === loc) && c.claimedAt >= Date.now() - 400 * 86_400_000).map((c) => ({ ...c, coveredIds: covered.get(c.id) ?? [], count: c.bookingIds.length + (covered.get(c.id)?.length ?? 0), ownerShare: claimOwnerShare(c, pctOf(chairs, c.barberId, c.locationId)) })),
  };
}

/** Owner marks a barber's takings as received: every unclaimed paid visit (cash and GCash) for that barber at that location, up to now (or on one Manila `day`). A lock doc serialises claims so a double tap can't claim twice. */
export async function claimRemit(shopId: string, barberId: string, locationId: string, claimedBy: string, day?: string, received?: number): Promise<RemitClaim> {
  const shop = shopRef(shopId);
  const lock = shop.collection("private").doc("remitLock");
  return shop.firestore.runTransaction(async (tx) => {
    await tx.get(lock);
    const { chairs, open, adjusts } = await load(shopId, true);
    // `day` (YYYY-MM-DD, Manila) limits the claim to that day's cuts (Weekly Profit Report); otherwise everything up to now.
    const onDay = (r: ChairRequest) => !day || new Date((r.completedAt ?? r.updatedAt ?? 0) + 8 * 3600_000).toISOString().slice(0, 10) === day;
    const mine = open.filter((r) => { const k = keyOf(r, chairs); return k.id === barberId && k.loc === locationId && onDay(r); });
    if (!mine.length) throw new Error("Nothing to claim for this barber.");
    const ref = shop.collection("remitClaims").doc();
    const times = mine.map((r) => r.completedAt ?? r.updatedAt ?? Date.now());
    const claim: RemitClaim = {
      id: ref.id, barberId, barberName: keyOf(mine[0]!, chairs).name, locationId,
      amount: mine.reduce((s, r) => s + (r.price || 0), 0), bookingIds: mine.map((r) => r.id),
      ownerShare: mine.reduce((s, r) => s + ownerShareOf(r.price || 0, visitPct(r, pctOf(chairs, barberId, locationId))), 0), sharePct: pctOf(chairs, barberId, locationId),
      from: Math.min(...times), to: Math.max(...times), claimedAt: Date.now(), claimedBy, rule: CLAIM_RULE,
    };
    // v1.0.40: a day claim without an amount uses the saved To claim edit (when it still matches the records).
    const saved = day ? adjusts.find((a) => a.barberId === barberId && a.locationId === locationId && a.day === day) : undefined;
    if (saved && received === undefined && adjustmentApplies(saved, claim.ownerShare ?? 0)) received = saved.received;
    if (saved) tx.delete(shop.collection("claimAdjusts").doc(adjustDocId(barberId, locationId, day!)));
    if (typeof received === "number") {
      const a = claimAdjust(claim.ownerShare ?? claim.amount, received);
      if (a.adjusted) Object.assign(claim, a, day ? { dayDeltas: { [day]: a.difference } } : {});
    }
    // v1.0.41: a claim covering several days (Claim all) keeps each covered day's saved To claim edit as that day's change.
    if (!day && received === undefined) {
      const deltas: Record<string, number> = {};
      for (const a of adjusts) {
        if (a.barberId !== barberId || a.locationId !== locationId) continue;
        const share = mine.filter((r) => manilaDay(r.completedAt ?? r.updatedAt ?? 0) === a.day).reduce((s, r) => s + ownerShareOf(r.price || 0, visitPct(r, pctOf(chairs, barberId, locationId))), 0);
        if (share <= 0) continue;
        if (Math.round(a.received - share)) deltas[a.day] = a.received - share;
        tx.delete(shop.collection("claimAdjusts").doc(adjustDocId(barberId, locationId, a.day)));
      }
      if (Object.keys(deltas).length) Object.assign(claim, withDayDeltas({ ...claim, expected: claim.ownerShare }, deltas));
    }
    tx.set(ref, claim);
    tx.set(lock, { at: claim.claimedAt, last: ref.id });
    cache.delete(shopId);
    return claim;
  });
}
