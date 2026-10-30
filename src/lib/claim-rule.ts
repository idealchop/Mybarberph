/**
 * THE claim rule (v1.0.25, Jimboy: "even it's GCash, it should still add it on the total").
 * - Claimable = a finished, paid visit with a price, ANY payment method (cash and GCash). The owner's own cuts never.
 * - A visit is claimed when a remit claim lists its booking id. Claims made from v1.0.25 (`rule: 2`) list GCash ids too.
 * - Older claims (no `rule`) listed cash only. Their GCash visits follow the day's claim: a GCash visit counts as claimed
 *   by an older claim of the same barber@location when its Manila day is inside the claim's days and it existed before
 *   the claim was made. Nothing stored is rewritten; amounts are always summed from the visits, never from claim docs,
 *   so nothing double counts.
 */
import { cutBarberId } from "@/lib/cut-count";

type Visit = { id: string; status?: string; paid?: boolean; payMethod?: string; price?: number; barberId?: string; locationId?: string; completedAt?: number; updatedAt?: number; createdAt?: number };
export type ClaimDoc = { id?: string; barberId: string; locationId: string; bookingIds?: string[]; from: number; to: number; claimedAt: number; rule?: number };

export const CLAIM_RULE = 2;
const ymd = (ms: number) => (Number.isFinite(ms) ? new Date(ms + 8 * 3600_000).toISOString().slice(0, 10) : "");
export const isClaimable = (r: Visit) => r.status === "done" && Boolean(r.paid) && (r.price || 0) > 0;

/** Lookup: the claim that covers a visit, if any. */
export function claimIndex<C extends ClaimDoc>(claims: C[], chairs: { id: string; barberId?: string; locationId?: string }[]) {
  const byId = new Map<string, C>();
  const legacy = new Map<string, C[]>();
  for (const c of claims) {
    for (const id of c.bookingIds ?? []) byId.set(id, c);
    if (c.rule !== CLAIM_RULE) { const k = `${c.barberId}@${c.locationId || "home"}`; legacy.set(k, [...(legacy.get(k) ?? []), c]); }
  }
  return (r: Visit): C | undefined => {
    const hit = byId.get(r.id);
    if (hit || (r.payMethod ?? "cash") === "cash") return hit;
    const list = legacy.get(`${cutBarberId(r as never, chairs as never)}@${r.locationId || "home"}`);
    if (!list) return undefined;
    const at = r.completedAt ?? r.updatedAt ?? 0, d = ymd(at), made = Math.max(at, r.createdAt ?? 0);
    return list.find((c) => { const a = ymd(c.from), b = ymd(c.to); return Boolean(a && b) && d >= a && d <= b && made <= c.claimedAt; });
  };
}
