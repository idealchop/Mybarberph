import { claimAdjust } from "@/lib/claim-adjust";
import "server-only";
import { isOwnerCut } from "@/lib/owner-cut";
import { claimOwnerShare, ownerShareOf, sharePct, visitPct } from "@/lib/income-split";
import type { ChairRequest } from "@/lib/booking-types";
import { loadState, shopRef } from "./shops";
import { cutBarberId, cutBarberName } from "@/lib/cut-count";
import { CLAIM_RULE, claimIndex, isClaimable } from "@/lib/claim-rule";

type Chair = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string; sharePct?: number | null; shareSet?: boolean };
export interface RemitClaim { id: string; barberId: string; barberName: string; locationId: string; amount: number; bookingIds: string[]; from: number; to: number; claimedAt: number; claimedBy: string;
  /** Owner/shop share claimed (amount minus the barber's split; None = all). Older claims lack it and are computed on read. */ ownerShare?: number; sharePct?: number | null;
  /** Adjusted claim (v1.0.34): owner entered the actual amount received. expected = owner share due, difference = received − expected. */ expected?: number; received?: number; adjusted?: boolean; difference?: number;
  /** 2 = lists GCash visits too (v1.0.25). Older claims listed cash only (lib/claim-rule.ts). */ rule?: number }
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

// Per-instance cache: Home, Sales and History all ask for the same summary; a claim clears it.
const cache = new Map<string, { at: number; data: Promise<Awaited<ReturnType<typeof loadFresh>>> }>();
function load(shopId: string, fresh = false) {
  const hit = cache.get(shopId);
  if (!fresh && hit && Date.now() - hit.at < 15_000) return hit.data;
  const data = loadFresh(shopId);
  cache.set(shopId, { at: Date.now(), data });
  data.catch(() => cache.delete(shopId));
  return data;
}

async function loadFresh(shopId: string) {
  const [claimsSnap, doneSnap, state] = await Promise.all([
    // Every claim (v1.0.24): with a 500 cap, older claims fell off and their visits looked unclaimed again.
    shopRef(shopId).collection("remitClaims").orderBy("claimedAt", "desc").get(),
    // Only the fields remit needs (not full booking docs).
    shopRef(shopId).collection("bookings").where("status", "==", "done").select("id", "status", "paid", "payMethod", "price", "barberId", "barberName", "seatLabel", "chairLabel", "locationId", "completedAt", "updatedAt", "createdAt", "splitPct").get(), // no cap (v1.0.24): an unordered 8,000 cap dropped arbitrary visits from To Claim
    loadState(shopId, ["barbers.shop-chairs"]),
  ]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const claims = claimsSnap.docs.map((d) => d.data() as RemitClaim);
  const covers = claimIndex(claims, chairs);
  const done = doneSnap.docs.map((d) => ({ ...(d.data() as ChairRequest), id: (d.data() as ChairRequest).id || d.id }));
  // Every claimed visit id: listed in a claim, or a GCash visit an older (cash-only) claim covers by day.
  const claimed = new Set(claims.flatMap((c) => c.bookingIds));
  const covered = new Map<string, string[]>(); // claim id → GCash visit ids it covers by day (older claims only)
  for (const r of done) { if (!isCash(r) || claimed.has(r.id)) continue; const c = covers(r); if (c) { claimed.add(r.id); covered.set(c.id, [...(covered.get(c.id) ?? []), r.id]); } }
  const open = done.filter((r) => isCash(r) && !claimed.has(r.id) && !isOwnerCut(r)); // the owner's own cuts: the money is already his
  return { chairs, claims, open, claimed, covered };
}

/** Ids of every visit the owner already claimed (locked for barber edits). */
export async function claimedBookingIds(shopId: string): Promise<Set<string>> {
  const { claimed } = await load(shopId);
  return claimed;
}

/** Unclaimed remit per barber (all time, up to now) and recent claims. `loc` = location id or "all". */
export async function remitSummary(shopId: string, loc: string) {
  const { chairs, claims, open, covered } = await load(shopId);
  const map = new Map<string, Unclaimed>();
  for (const r of open) {
    const k = keyOf(r, chairs);
    if (loc !== "all" && k.loc !== loc) continue;
    const id = `${k.id}@${k.loc}`;
    const u = map.get(id) ?? { barberId: k.id, barberName: k.name, locationId: k.loc, amount: 0, ownerShare: 0, count: 0, oldest: Date.now() };
    u.amount += r.price || 0; u.ownerShare += ownerShareOf(r.price || 0, visitPct(r, pctOf(chairs, k.id, k.loc))); u.count += 1; u.oldest = Math.min(u.oldest, r.completedAt ?? r.updatedAt ?? Date.now());
    map.set(id, u);
  }
  const unclaimed = [...map.values()].sort((a, b) => b.ownerShare - a.ownerShare);
  return {
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
    const { chairs, open } = await load(shopId, true);
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
    if (typeof received === "number") {
      const a = claimAdjust(claim.ownerShare ?? claim.amount, received);
      if (a.adjusted) Object.assign(claim, a);
    }
    tx.set(ref, claim);
    tx.set(lock, { at: claim.claimedAt, last: ref.id });
    cache.delete(shopId);
    return claim;
  });
}
