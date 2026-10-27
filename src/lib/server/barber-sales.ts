import "server-only";
import type { ChairRequest } from "@/lib/booking-types";
import { barberRange, manilaYmd, type BarberPerformance, type BarberSalesRow } from "@/lib/barber-sales";
import { payBucket } from "@/lib/pay-split";
import { cutMinutes, sharePct, splitIncome, tipOf } from "@/lib/income-split";
import { loadState, shopRef } from "./shops";
import { cutBarberId, cutBarberName } from "@/lib/cut-count";

type Chair = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string; sharePct?: number | null; shareSet?: boolean };

/** Finished visits per barber (Manila time) for salary and cash remittance. */
export async function barberSales(shopId: string, q: { range?: string | null; from?: string | null; to?: string | null; loc?: string | null; barberId?: string | null }) {
  const r = barberRange(q.range, q.from, q.to);
  const snap = await shopRef(shopId).collection("bookings").where("completedAt", ">=", r.from).where("completedAt", "<", r.to).get();
  const state = await loadState(shopId, ["barbers.shop-chairs", "barbers.shop-locations"]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const locs = (() => { try { return (JSON.parse(state["barbers.shop-locations"] || "{}").branches || []) as { id: string; name: string }[]; } catch { return []; } })();
  const locName = (id: string) => locs.find((x) => x.id === id)?.name || id;
  const loc = q.loc && q.loc !== "all" ? q.loc : null;
  const rows = new Map<string, BarberSalesRow>();
  for (const d of snap.docs) {
    const b = d.data() as ChairRequest;
    if (b.status !== "done") continue;
    const bl = b.locationId || "home";
    if (loc && bl !== loc) continue;
    // Same identity rule as every other screen: barberId only, else Unassigned (src/lib/cut-count.ts).
    const id = cutBarberId(b, chairs);
    if (q.barberId && id !== q.barberId) continue;
    const name = cutBarberName(b, chairs);
    const key = `${id}@${bl}`;
    const row = rows.get(key) ?? { barberId: id, barberName: name, locationId: bl, locationName: locName(bl), cuts: 0, gross: 0, cash: 0, gcash: 0, online: 0, unpaid: 0, remit: 0 };
    row.cuts += 1;
    row.gross += b.price || 0;
    if (!b.paid) row.unpaid += b.price || 0;
    else if (b.payMethod === "gcash") row.gcash += b.price || 0;
    else if (b.payMethod === "online") row.online += b.price || 0;
    else row.cash += b.price || 0;
    row.remit = row.cash;
    rows.set(key, row);
  }
  const list = [...rows.values()].sort((a, b) => b.gross - a.gross);
  const total = list.reduce((t, x) => ({ ...t, cuts: t.cuts + x.cuts, gross: t.gross + x.gross, cash: t.cash + x.cash, gcash: t.gcash + x.gcash, online: t.online + x.online, unpaid: t.unpaid + x.unpaid, remit: t.remit + x.remit }),
    { barberId: "all", barberName: "All barbers", cuts: 0, gross: 0, cash: 0, gcash: 0, online: 0, unpaid: 0, remit: 0 });
  return { ...r, barbers: list, total };
}


/** One barber's richer numbers for their link's My sales page (Manila time). */
export async function barberPerformance(shopId: string, q: { range?: string | null; from?: string | null; to?: string | null; barberId: string; chairId: string; locationId?: string }): Promise<BarberPerformance> {
  const r = barberRange(q.range, q.from, q.to);
  const shop = shopRef(shopId);
  const [snap, claimSnap, state] = await Promise.all([
    shop.collection("bookings").where("completedAt", ">=", r.from).where("completedAt", "<", r.to).get(),
    shop.collection("remitClaims").where("barberId", "==", q.barberId).get(),
    loadState(shopId, ["barbers.shop-chairs"]),
  ]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const me = chairs.find((c) => c.id === q.chairId);
  const myLoc = q.locationId || me?.locationId || "home";
  const isMine = (b: ChairRequest) => {
    const bl = b.locationId || "home";
    // A link is one chair at one location: count only that location, as the link's Queue/History and the
    // owner's per-location Sales do. (Before, a barber on chairs in two branches got both branches here.)
    if (bl !== myLoc) return false;
    return cutBarberId(b, chairs) === q.barberId;
  };
  const claims = claimSnap.docs.map((d) => d.data() as { id: string; amount: number; bookingIds: string[]; claimedAt: number }).sort((a, b) => b.claimedAt - a.claimedAt);
  const claimed = new Set(claims.flatMap((c) => c.bookingIds || []));
  const out: BarberPerformance = {
    label: r.label, from: r.from, to: r.to, cuts: 0, sales: 0, cash: 0, gcash: 0, online: 0, other: 0, unpaid: 0, remit: 0, avg: 0, completionPct: null, declined: 0,
    walkIns: 0, onlineBookings: 0, claimedCash: 0, unclaimedCash: 0, hours: [], days: [], services: [],
    claims: claims.slice(0, 50).map((c) => ({ id: c.id, amount: c.amount, count: (c.bookingIds || []).length, claimedAt: c.claimedAt })),
  };
  const byDate = new Map<string, { cuts: number; sales: number; tips: number }>();
  const hours = new Map<number, number>(); const days = new Map<string, { cuts: number; sales: number }>(); const svc = new Map<string, { cuts: number; sales: number }>();
  let tips = 0, tipCount = 0, mins = 0, timed = 0, fastest = Infinity;
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of snap.docs) {
    const b = d.data() as ChairRequest;
    if (!isMine(b)) continue;
    if (b.status === "declined" && (b.updatedAt ?? b.createdAt) >= r.from && (b.updatedAt ?? b.createdAt) < r.to) { out.declined += 1; continue; }
    if (b.status !== "done" || !b.completedAt || b.completedAt < r.from || b.completedAt >= r.to) continue;
    const p = b.price || 0;
    out.cuts += 1; out.sales += p;
    const tp = tipOf(b); if (tp) { tips += tp; tipCount += 1; }
    const dk = manilaYmd(b.completedAt); const dv = byDate.get(dk) ?? { cuts: 0, sales: 0, tips: 0 }; dv.cuts += 1; dv.sales += p; dv.tips += tp; byDate.set(dk, dv);
    const cm = cutMinutes(b); if (cm != null) { mins += cm; timed += 1; fastest = Math.min(fastest, cm); }
    if (!b.paid) out.unpaid += p;
    else {
      const k = payBucket(b);
      out[k] += p;
      // Cash to hand over: cash (a paid visit with no method is cash, lib/server/remit.ts).
      if (k === "cash" || k === "other") { out.remit += p; if (claimed.has(b.id)) out.claimedCash += p; else out.unclaimedCash += p; }
    }
    if (b.channel === "online") out.onlineBookings += 1; else out.walkIns += 1;
    const local = new Date(b.completedAt + 8 * 3600_000);
    hours.set(local.getUTCHours(), (hours.get(local.getUTCHours()) ?? 0) + 1);
    const wd = WD[local.getUTCDay()]!; const dd = days.get(wd) ?? { cuts: 0, sales: 0 }; dd.cuts += 1; dd.sales += p; days.set(wd, dd);
    const name = (b.serviceName || "Service").trim(); const s = svc.get(name) ?? { cuts: 0, sales: 0 }; s.cuts += 1; s.sales += p; svc.set(name, s);
  }
  out.avg = out.cuts ? Math.round(out.sales / out.cuts) : 0;
  out.sharePct = sharePct(me);
  const split = splitIncome(out.sales, out.sharePct);
  out.byDate = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, v]) => ({ date, ...v, earnings: (out.sharePct == null ? v.sales : splitIncome(v.sales, out.sharePct).barber) + v.tips }));
  out.barberShare = split.barber; out.shopShare = split.shop; out.tips = tips; out.tipCount = tipCount;
  out.timedCuts = timed; out.avgMins = timed ? Math.round(mins / timed) : null; out.fastestMins = timed ? Math.round(fastest) : null;
  out.completionPct = out.cuts + out.declined ? Math.round((out.cuts / (out.cuts + out.declined)) * 100) : null;
  out.hours = [...hours.entries()].map(([hour, cuts]) => ({ hour, cuts })).sort((a, b) => a.hour - b.hour);
  out.days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, ...(days.get(day) ?? { cuts: 0, sales: 0 }) }));
  out.services = [...svc.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sales - a.sales);
  return out;
}
