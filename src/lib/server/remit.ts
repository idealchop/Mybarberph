import "server-only";
import { isOwnerCut } from "@/lib/owner-cut";
import type { ChairRequest } from "@/lib/booking-types";
import { loadState, shopRef } from "./shops";

type Chair = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string };
export interface RemitClaim { id: string; barberId: string; barberName: string; locationId: string; amount: number; bookingIds: string[]; from: number; to: number; claimedAt: number; claimedBy: string }
export interface Unclaimed { barberId: string; barberName: string; locationId: string; amount: number; count: number; oldest: number }

const HOME = "home";
const keyOf = (r: ChairRequest, chairs: Chair[]) => {
  const bl = r.locationId || HOME;
  const seat = chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || HOME) === bl);
  return { id: r.barberId || seat?.barberId || seat?.id || `seat:${bl}:${r.seatLabel || "-"}`, name: r.barberName || seat?.barberName?.trim() || r.seatLabel || "No barber", loc: bl };
};
/** Cash the barber collected = done, paid, cash. */
const isCash = (r: ChairRequest) => r.status === "done" && Boolean(r.paid) && (r.payMethod ?? "cash") === "cash" && (r.price || 0) > 0;

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
    shopRef(shopId).collection("remitClaims").orderBy("claimedAt", "desc").limit(500).get(),
    // Only the fields remit needs (not full booking docs).
    shopRef(shopId).collection("bookings").where("status", "==", "done").select("id", "status", "paid", "payMethod", "price", "barberId", "barberName", "seatLabel", "chairLabel", "locationId", "completedAt", "updatedAt").limit(8000).get(),
    loadState(shopId, ["barbers.shop-chairs"]),
  ]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const claims = claimsSnap.docs.map((d) => d.data() as RemitClaim);
  const claimed = new Set(claims.flatMap((c) => c.bookingIds));
  const open = doneSnap.docs.map((d) => d.data() as ChairRequest).filter((r) => isCash(r) && !claimed.has(r.id) && !isOwnerCut(r)); // the owner's own cuts: cash is already his
  return { chairs, claims, open };
}

/** Unclaimed remit per barber (all time, up to now) and recent claims. `loc` = location id or "all". */
export async function remitSummary(shopId: string, loc: string) {
  const { chairs, claims, open } = await load(shopId);
  const map = new Map<string, Unclaimed>();
  for (const r of open) {
    const k = keyOf(r, chairs);
    if (loc !== "all" && k.loc !== loc) continue;
    const id = `${k.id}@${k.loc}`;
    const u = map.get(id) ?? { barberId: k.id, barberName: k.name, locationId: k.loc, amount: 0, count: 0, oldest: Date.now() };
    u.amount += r.price || 0; u.count += 1; u.oldest = Math.min(u.oldest, r.completedAt ?? r.updatedAt ?? Date.now());
    map.set(id, u);
  }
  const unclaimed = [...map.values()].sort((a, b) => b.amount - a.amount);
  return { unclaimed, total: unclaimed.reduce((s, u) => s + u.amount, 0), claims: claims.filter((c) => loc === "all" || c.locationId === loc).slice(0, 100).map((c) => ({ ...c, count: c.bookingIds.length })) };
}

/** Owner marks a barber's cash as received: every unclaimed paid-cash visit for that barber at that location, up to now. A lock doc serialises claims so a double tap can't claim twice. */
export async function claimRemit(shopId: string, barberId: string, locationId: string, claimedBy: string): Promise<RemitClaim> {
  const shop = shopRef(shopId);
  const lock = shop.collection("private").doc("remitLock");
  return shop.firestore.runTransaction(async (tx) => {
    await tx.get(lock);
    const { chairs, open } = await load(shopId, true);
    const mine = open.filter((r) => { const k = keyOf(r, chairs); return k.id === barberId && k.loc === locationId; });
    if (!mine.length) throw new Error("Nothing to claim for this barber.");
    const ref = shop.collection("remitClaims").doc();
    const times = mine.map((r) => r.completedAt ?? r.updatedAt ?? Date.now());
    const claim: RemitClaim = {
      id: ref.id, barberId, barberName: keyOf(mine[0]!, chairs).name, locationId,
      amount: mine.reduce((s, r) => s + (r.price || 0), 0), bookingIds: mine.map((r) => r.id),
      from: Math.min(...times), to: Math.max(...times), claimedAt: Date.now(), claimedBy,
    };
    tx.set(ref, claim);
    tx.set(lock, { at: claim.claimedAt, last: ref.id });
    cache.delete(shopId);
    return claim;
  });
}
