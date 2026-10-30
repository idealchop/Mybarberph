import "server-only";
import type { ChairRequest } from "@/lib/booking-types";
import { barberRange, manilaYmd, type BarberPerformance, type BarberProfile, type BarberSalesRow } from "@/lib/barber-sales";
import { payBucket } from "@/lib/pay-split";
import { cutMinutes, ownerShareOf, sharePct, splitIncome, tipOf, visitPct } from "@/lib/income-split";
import { loadState, shopRef } from "./shops";
import { claimedBookingIds } from "./remit";
import { historyRow } from "@/lib/barber-history";
import { cutBarberId, cutBarberName, isFinishedCut } from "@/lib/cut-count";

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
  const claims = claimSnap.docs.map((d) => d.data() as { id: string; amount: number; ownerShare?: number; bookingIds: string[]; claimedAt: number; locationId?: string }).sort((a, b) => b.claimedAt - a.claimedAt);
  const claimed = new Set(claims.flatMap((c) => c.bookingIds || []));
  const out: BarberPerformance = {
    label: r.label, from: r.from, to: r.to, cuts: 0, sales: 0, cash: 0, gcash: 0, online: 0, other: 0, unpaid: 0, remit: 0, avg: 0, completionPct: null, declined: 0,
    walkIns: 0, onlineBookings: 0, claimedCash: 0, unclaimedCash: 0, hours: [], days: [], services: [],
    claims: claims.slice(0, 50).map((c) => ({ id: c.id, amount: c.amount, ownerShare: c.ownerShare, count: (c.bookingIds || []).length, claimedAt: c.claimedAt })),
  };
  const myPct = sharePct(me);
  const byDate = new Map<string, { cuts: number; sales: number; tips: number; barber: number }>();
  let barberSum = 0;
  const hourEarn = new Map<number, number>();
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
    const vp = visitPct(b, myPct); const bs = vp == null ? 0 : splitIncome(p, vp).barber; barberSum += bs;
    const dk = manilaYmd(b.completedAt); const dv = byDate.get(dk) ?? { cuts: 0, sales: 0, tips: 0, barber: 0 }; dv.cuts += 1; dv.sales += p; dv.tips += tp; dv.barber += vp == null ? p : bs; byDate.set(dk, dv);
    { const h = new Date(b.completedAt + 8 * 3600_000).getUTCHours(); hourEarn.set(h, (hourEarn.get(h) ?? 0) + (vp == null ? p : bs) + tp); }
    const cm = cutMinutes(b); if (cm != null) { mins += cm; timed += 1; fastest = Math.min(fastest, cm); }
    if (!b.paid) out.unpaid += p;
    else {
      const k = payBucket(b);
      out[k] += p;
      // Cash to hand over: cash (a paid visit with no method is cash, lib/server/remit.ts).
      if (k === "cash" || k === "other") { out.remit += p; if (claimed.has(b.id)) out.claimedCash += p; else { out.unclaimedCash += p; out.unclaimedOwner = (out.unclaimedOwner ?? 0) + ownerShareOf(p, visitPct(b, myPct)); } }
    }
    if (b.channel === "online") out.onlineBookings += 1; else out.walkIns += 1;
    const local = new Date(b.completedAt + 8 * 3600_000);
    hours.set(local.getUTCHours(), (hours.get(local.getUTCHours()) ?? 0) + 1);
    const wd = WD[local.getUTCDay()]!; const dd = days.get(wd) ?? { cuts: 0, sales: 0 }; dd.cuts += 1; dd.sales += p; days.set(wd, dd);
    const name = (b.serviceName || "Service").trim(); const s = svc.get(name) ?? { cuts: 0, sales: 0 }; s.cuts += 1; s.sales += p; svc.set(name, s);
  }
  out.avg = out.cuts ? Math.round(out.sales / out.cuts) : 0;
  out.sharePct = sharePct(me);
  // Per-visit split (each visit's own %; centavo rounding per visit, owner gets the remainder), summed. Never re-split a total.
  out.byDate = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, v]) => ({ date, cuts: v.cuts, sales: v.sales, tips: v.tips, earnings: v.barber + v.tips }));
  out.barberShare = barberSum; out.shopShare = out.sales - barberSum; out.tips = tips; out.tipCount = tipCount;
  out.timedCuts = timed; out.avgMins = timed ? Math.round(mins / timed) : null; out.fastestMins = timed ? Math.round(fastest) : null;
  out.completionPct = out.cuts + out.declined ? Math.round((out.cuts / (out.cuts + out.declined)) * 100) : null;
  out.hourEarnings = [...hourEarn.entries()].map(([hour, earnings]) => ({ hour, earnings })).sort((a, b) => a.hour - b.hour);
  out.hours = [...hours.entries()].map(([hour, cuts]) => ({ hour, cuts })).sort((a, b) => a.hour - b.hour);
  out.days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, ...(days.get(day) ?? { cuts: 0, sales: 0 }) }));
  out.services = [...svc.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sales - a.sales);
  return out;
}

/**
 * ONE barber's finished cuts on ONE Manila day at ONE branch: the single source both the barber link History and
 * the owner's Weekly Profit day sheet read (v1.0.21), with the shared rule (src/lib/cut-count.ts).
 */
export async function barberDayCuts(shopId: string, q: { date: string; barberId: string; locationId: string; chairId?: string }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : manilaYmd(Date.now());
  const from = Date.parse(`${date}T00:00:00+08:00`), end = from + 86_400_000;
  const [snap, state, claimed] = await Promise.all([
    shopRef(shopId).collection("bookings").where("completedAt", ">=", from).where("completedAt", "<", end).get(),
    loadState(shopId, ["barbers.shop-chairs"]),
    claimedBookingIds(shopId).catch(() => new Set<string>()),
  ]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[];
  const me = chairs.find((c) => c.id === q.chairId) ?? chairs.find((c) => (c.barberId || c.id) === q.barberId && (c.locationId || "home") === q.locationId);
  // Raw docs: older or partner-made visits can miss id/ref/serviceName; normalise so the History screen never crashes on one.
  const rows = snap.docs.map((d) => historyRow(d.id, d.data() as Partial<ChairRequest>))
    .filter((b) => isFinishedCut(b) && (b.locationId || "home") === q.locationId && cutBarberId(b, chairs) === q.barberId)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return { date, sharePct: sharePct(me), rows, locked: rows.filter((r) => claimed.has(r.id)).map((r) => r.id) };
}

/** Barber link History for one day (the link's own barber and branch). */
export async function barberHistory(shopId: string, q: { date: string; barberId: string; chairId: string; locationId?: string }) {
  const state = q.locationId ? null : await loadState(shopId, ["barbers.shop-chairs"]);
  const chairs = state ? (JSON.parse(state["barbers.shop-chairs"] || "[]") as Chair[]) : [];
  const loc = q.locationId || chairs.find((c) => c.id === q.chairId)?.locationId || "home";
  return barberDayCuts(shopId, { date: q.date, barberId: q.barberId, locationId: loc, chairId: q.chairId });
}

/**
 * The barber's own profile on their link (v1.0.22): read-only, the barber's share + tips only. Rank is a position
 * among the shop's barbers; no other barber's amounts leave the server.
 */
export async function barberProfile(shopId: string, q: { range?: string | null; barberId: string; chairId: string; locationId?: string }, now = Date.now()): Promise<BarberProfile> {
  const range: BarberProfile["range"] = q.range === "today" || q.range === "all" ? q.range : "7d";
  const ymd = (ms: number) => manilaYmd(ms);
  const from = range === "today" ? ymd(now) : range === "7d" ? ymd(now - 6 * 86_400_000) : ymd(now - 365 * 86_400_000);
  const to = ymd(now);
  const [perf, all, everyone] = await Promise.all([
    barberPerformance(shopId, { ...q, range: "custom", from, to }),
    range === "all" ? null : barberPerformance(shopId, { ...q, range: "custom", from: ymd(now - 365 * 86_400_000), to }),
    barberSales(shopId, { range: "custom", from, to }),
  ]);
  const state = await loadState(shopId, ["barbers.shop-chairs"]);
  const chairs = JSON.parse(state["barbers.shop-chairs"] || "[]") as (Chair & { active?: boolean })[];
  const gross = new Map<string, number>();
  for (const c of chairs) if (c.active !== false) gross.set(c.barberId || c.id, 0);
  for (const b of everyone.barbers) if (b.barberId !== "unassigned" && !b.barberId.startsWith("name:") && b.barberId !== "owner") gross.set(b.barberId, (gross.get(b.barberId) ?? 0) + b.gross);
  const order = [...gross.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const pos = order.indexOf(q.barberId);
  const byDate = (perf.byDate ?? []).map((d) => ({ date: d.date, cuts: d.cuts, earnings: d.earnings, tips: d.tips })).sort((a, b) => (a.date < b.date ? -1 : 1));
  const earnings = byDate.reduce((s, d) => s + d.earnings, 0);
  const tips = byDate.reduce((s, d) => s + d.tips, 0);
  const hourEarnings = perf.hourEarnings ?? [];
  const counts = new Map(perf.hours.map((h) => [h.hour, h.cuts]));
  const peak = [...hourEarnings].sort((a, b) => b.earnings - a.earnings)[0];
  const allTime = all ?? perf;
  return {
    range, from, to, label: perf.label,
    sharePct: perf.sharePct ?? null,
    rank: pos >= 0 && (gross.get(q.barberId) ?? 0) > 0 ? pos + 1 : null, of: order.length,
    cuts: perf.cuts, earnings, share: earnings - tips, tips,
    avgTicket: perf.cuts ? Math.round(earnings / perf.cuts) : 0,
    perHour: perf.timedCuts && perf.avgMins ? Math.round((60 / perf.avgMins) * 10) / 10 : null,
    peakHour: peak ? { hour: peak.hour, earnings: peak.earnings, cuts: counts.get(peak.hour) ?? 0 } : null,
    toClaim: allTime.unclaimedOwner ?? 0,
    claimed: allTime.claims.reduce((s, c) => s + (c.ownerShare ?? 0), 0),
    byDate, byHour: hourEarnings.map((h) => ({ hour: h.hour, earnings: h.earnings, cuts: counts.get(h.hour) ?? 0 })),
  };
}
