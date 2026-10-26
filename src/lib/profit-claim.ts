/**
 * The Claim figure for one barber on one Manila day (Weekly Profit Report sheet). Same rules as the Sales
 * "Claiming" remit (server/remit.ts): only finished, paid, cash cuts with a price; the owner's own cuts never;
 * a cut is claimed when a remit claim lists its booking id. Amounts are the owner's share (price minus the barber's split).
 */
import { ownerShareOf, sharePct } from "@/lib/income-split";

type Visit = { id: string; status?: string; paid?: boolean; payMethod?: string; price?: number; barberId?: string; seatLabel?: string; chairLabel?: string; locationId?: string; completedAt?: number; updatedAt?: number };
type Chair = { id: string; label?: string; barberId?: string; locationId?: string; sharePct?: unknown; shareSet?: unknown };

const day = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const isCash = (r: Visit) => r.status === "done" && Boolean(r.paid) && (r.payMethod ?? "cash") === "cash" && (r.price || 0) > 0;

/** The remit key of a visit (same as the server's): its barberId, else the seat's barber at that branch. */
export function remitKey(r: Visit, chairs: Chair[]) {
  const bl = r.locationId || "home";
  const seat = chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || "home") === bl);
  return { id: r.barberId || seat?.barberId || seat?.id || `seat:${bl}:${r.seatLabel || "-"}`, loc: bl };
}

export function dayClaim(rows: Visit[], chairs: Chair[], barberId: string, locationId: string, ymd: string, isClaimed: (bookingId: string) => boolean) {
  const c = chairs.find((x) => (x.barberId === barberId || x.id === barberId) && (x.locationId || "home") === locationId) ?? chairs.find((x) => x.barberId === barberId || x.id === barberId);
  const pct = barberId === "owner" ? null : c ? sharePct(c) : null;
  const out = { open: 0, openCash: 0, openCount: 0, claimed: 0, claimedCount: 0, owner: barberId === "owner" };
  if (out.owner) return out;
  for (const r of rows) {
    if (!isCash(r)) continue;
    const k = remitKey(r, chairs);
    if (k.id !== barberId || k.loc !== locationId || day(r.completedAt ?? r.updatedAt ?? 0) !== ymd) continue;
    const share = ownerShareOf(r.price || 0, pct);
    if (isClaimed(r.id)) { out.claimed += share; out.claimedCount++; } else { out.open += share; out.openCash += r.price || 0; out.openCount++; }
  }
  return out;
}
