import "server-only";
import type { ChairRequest } from "@/lib/booking-types";
import { loadState, shopRef } from "@/lib/server/shops";

/**
 * Read-only view of one owner's shop for the Companion. Nothing here writes business data.
 * Money is returned in pesos (bookings store centavos).
 */
export interface ShopData {
  shopName: string;
  plan: string;
  bookings: ChairRequest[];
  chairs: { label: string; barberName: string; locationId: string }[];
  branches: { id: string; name: string }[];
}

const DAY = 86_400_000;
const HOME = "home";
export const pesos = (c: number) => Math.round(c) / 100;

export function manilaDay(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export async function loadShopData(shopId: string, shopName: string, plan: string): Promise<ShopData> {
  const [snap, state] = await Promise.all([
    shopRef(shopId).collection("bookings").where("createdAt", ">=", Date.now() - 120 * DAY).orderBy("createdAt", "desc").limit(5000).get(),
    loadState(shopId, ["barbers.shop-chairs", "barbers.shop-locations", "barbers.shop-profile"]),
  ]);
  const parse = (k: string) => { try { return JSON.parse(state[k] || "null"); } catch { return null; } };
  const chairsRaw = parse("barbers.shop-chairs");
  const locRaw = parse("barbers.shop-locations");
  const profile = parse("barbers.shop-profile");
  const chairs = (Array.isArray(chairsRaw) ? chairsRaw : []).map((c: Record<string, unknown>) => ({
    label: String(c.label ?? ""), barberName: String(c.barberName ?? "") || String(c.label ?? "Chair"), locationId: String(c.locationId ?? HOME),
  }));
  const branchesRaw = locRaw && Array.isArray(locRaw.branches) ? locRaw.branches : [];
  const branches = branchesRaw.length
    ? branchesRaw.map((b: Record<string, unknown>) => ({ id: String(b.id ?? HOME), name: String(b.name ?? "Shop") }))
    : [{ id: HOME, name: shopName || profile?.name || "Main shop" }];
  return { shopName: shopName || profile?.name || "your shop", plan, bookings: snap.docs.map((d) => d.data() as ChairRequest), chairs, branches };
}

function scope(d: ShopData, locationId?: string) {
  if (!locationId || locationId === "all") return d.bookings;
  return d.bookings.filter((b) => (b.locationId || HOME) === locationId);
}
const doneIn = (rows: ChairRequest[], from: number, to = Date.now()) =>
  rows.filter((b) => b.status === "done" && (b.completedAt ?? b.updatedAt) >= from && (b.completedAt ?? b.updatedAt) < to);
const total = (rows: ChairRequest[]) => pesos(rows.reduce((s, b) => s + (b.price || 0), 0));
const clampDays = (n: unknown, def = 7) => Math.max(1, Math.min(120, Math.round(Number(n) || def)));
const who = (b: ChairRequest) => (b.contact || b.customerLabel || "").trim().toLowerCase();
function barberOf(d: ShopData, b: ChairRequest) {
  const seat = b.seatLabel || b.chairLabel || "";
  const c = d.chairs.find((x) => x.label === seat && x.locationId === (b.locationId || HOME)) ?? d.chairs.find((x) => x.label === seat);
  return c?.barberName || seat || "Unassigned";
}

export function getSales(d: ShopData, a: { days?: number; locationId?: string }) {
  const days = clampDays(a.days);
  const rows = scope(d, a.locationId);
  const now = Date.now();
  const cur = doneIn(rows, now - days * DAY);
  const prev = doneIn(rows, now - 2 * days * DAY, now - days * DAY);
  const byDay: Record<string, { sales: number; cuts: number }> = {};
  for (const b of cur) { const k = manilaDay(b.completedAt ?? b.updatedAt); byDay[k] ??= { sales: 0, cuts: 0 }; byDay[k].sales += pesos(b.price); byDay[k].cuts++; }
  const unpaid = rows.filter((b) => b.status === "done" && !b.paid && (b.completedAt ?? b.updatedAt) >= now - days * DAY);
  const s = total(cur);
  return { days, salesPhp: s, cuts: cur.length, avgTicketPhp: cur.length ? Math.round(s / cur.length) : 0, previousPeriodSalesPhp: total(prev), previousPeriodCuts: prev.length, unpaidPhp: total(unpaid), byDay };
}

export function getBookings(d: ShopData, a: { days?: number; locationId?: string }) {
  const days = clampDays(a.days);
  const rows = scope(d, a.locationId).filter((b) => b.createdAt >= Date.now() - days * DAY);
  const count = (f: (b: ChairRequest) => string) => rows.reduce<Record<string, number>>((m, b) => { const k = f(b); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const hours = count((b) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric" }).format(new Date(b.createdAt)));
  const weekdays = count((b) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(new Date(b.createdAt)));
  const wd = (b: ChairRequest) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(new Date(b.createdAt));
  const by = (list: ChairRequest[], f: (b: ChairRequest) => string) => list.reduce<Record<string, number>>((m, b) => { const k = f(b); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const walkIns = rows.filter((b) => b.channel === "walk-in"), online = rows.filter((b) => b.channel === "online");
  return { days, total: rows.length, walkInsByWeekday: by(walkIns, wd), onlineByWeekday: by(online, wd), byStatus: count((b) => b.status), byChannel: count((b) => b.channel), bySource: count((b) => b.source || (b.channel === "walk-in" ? "walk-in" : "online")), byHour: hours, byWeekday: weekdays, declined: rows.filter((b) => b.status === "declined").length };
}

export function topServices(d: ShopData, a: { days?: number; locationId?: string; limit?: number }) {
  const days = clampDays(a.days, 30);
  const rows = doneIn(scope(d, a.locationId), Date.now() - days * DAY);
  const m = new Map<string, { service: string; cuts: number; salesPhp: number }>();
  for (const b of rows) { const k = b.serviceName || "Service"; const r = m.get(k) ?? { service: k, cuts: 0, salesPhp: 0 }; r.cuts++; r.salesPhp += pesos(b.price); m.set(k, r); }
  return { days, services: [...m.values()].sort((x, y) => y.salesPhp - x.salesPhp).slice(0, Math.max(1, Math.min(20, a.limit ?? 10))) };
}

/** Per-barber revenue, cuts, chair use (minutes seated vs a 10-hour day) and rebooking rate. */
export function staffPerformance(d: ShopData, a: { days?: number; locationId?: string }) {
  const days = clampDays(a.days, 30);
  const all = scope(d, a.locationId);
  const rows = doneIn(all, Date.now() - days * DAY);
  const m = new Map<string, { barber: string; cuts: number; salesPhp: number; minutes: number; customers: Set<string>; returned: Set<string>; days: Set<string> }>();
  for (const b of rows) {
    const k = barberOf(d, b);
    const r = m.get(k) ?? { barber: k, cuts: 0, salesPhp: 0, minutes: 0, customers: new Set(), returned: new Set(), days: new Set() };
    r.cuts++; r.salesPhp += pesos(b.price);
    if (b.startedAt && b.completedAt && b.completedAt > b.startedAt) r.minutes += Math.min(180, (b.completedAt - b.startedAt) / 60_000);
    r.days.add(manilaDay(b.completedAt ?? b.updatedAt));
    const c = who(b);
    if (c) {
      if (all.some((o) => o !== b && who(o) === c && o.createdAt > b.createdAt && o.status !== "declined")) r.returned.add(c);
      r.customers.add(c);
    }
    m.set(k, r);
  }
  return {
    days,
    barbers: [...m.values()].map((r) => ({
      barber: r.barber, cuts: r.cuts, salesPhp: r.salesPhp, avgTicketPhp: r.cuts ? Math.round(r.salesPhp / r.cuts) : 0,
      daysWorked: r.days.size, chairUsePct: r.days.size ? Math.round((r.minutes / (r.days.size * 600)) * 100) : null,
      rebookingRatePct: r.customers.size ? Math.round((r.returned.size / r.customers.size) * 100) : null, knownCustomers: r.customers.size,
    })).sort((x, y) => y.salesPhp - x.salesPhp),
    note: "Chair use = minutes seated / 10-hour days worked. Rebooking = known customers who came back after a visit with this barber.",
  };
}

export function branchComparison(d: ShopData, a: { days?: number }) {
  const days = clampDays(a.days, 30);
  return { days, branches: d.branches.map((br) => { const s = getSales(d, { days, locationId: br.id }); return { branch: br.name, locationId: br.id, salesPhp: s.salesPhp, cuts: s.cuts, avgTicketPhp: s.avgTicketPhp, previousPeriodSalesPhp: s.previousPeriodSalesPhp }; }) };
}

/** Customers whose last visit is older than `days`. Contacts only when the owner asked for them. */
export function inactiveCustomers(d: ShopData, a: { days?: number; locationId?: string; includeContacts?: boolean }, allowContacts: boolean) {
  const days = clampDays(a.days, 30);
  const last = new Map<string, { last: number; visits: number; label: string; contact: string }>();
  for (const b of scope(d, a.locationId)) {
    if (b.status !== "done") continue;
    const k = who(b); if (!k) continue;
    const t = b.completedAt ?? b.updatedAt;
    const r = last.get(k) ?? { last: 0, visits: 0, label: b.customerLabel, contact: b.contact };
    r.visits++; if (t > r.last) r.last = t; last.set(k, r);
  }
  const cutoff = Date.now() - days * DAY;
  const lapsed = [...last.values()].filter((r) => r.last < cutoff).sort((x, y) => y.visits - x.visits);
  const show = allowContacts && a.includeContacts;
  return {
    days, inactiveCount: lapsed.length, knownCustomers: last.size, regularsLapsed: lapsed.filter((r) => r.visits >= 2).length,
    customers: show ? lapsed.slice(0, 25).map((r) => ({ name: r.label, contact: r.contact, visits: r.visits, lastVisit: manilaDay(r.last) })) : undefined,
    contactsHidden: !show,
  };
}

export interface Goal { id: string; kind: "monthly_sales" | "weekly_cuts" | "custom"; targetPhp?: number; targetCount?: number; text: string; createdAt: number }

export function goalProgress(d: ShopData, goals: Goal[]) {
  const now = new Date();
  const ym = manilaDay(now.getTime()).slice(0, 7);
  const monthRows = d.bookings.filter((b) => b.status === "done" && manilaDay(b.completedAt ?? b.updatedAt).startsWith(ym));
  const monthSales = total(monthRows);
  const dayOfMonth = Number(manilaDay(now.getTime()).slice(8, 10));
  const [y, mo] = ym.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(y, mo, 0).getDate();
  const week = getSales(d, { days: 7 });
  return {
    month: ym, monthSalesPhp: monthSales, projectedMonthPhp: Math.round((monthSales / Math.max(1, dayOfMonth)) * daysInMonth),
    goals: goals.map((g) => g.kind === "monthly_sales" && g.targetPhp
      ? { ...g, progressPct: Math.round((monthSales / g.targetPhp) * 100), neededPerDayPhp: Math.max(0, Math.round((g.targetPhp - monthSales) / Math.max(1, daysInMonth - dayOfMonth + 1))) }
      : g.kind === "weekly_cuts" && g.targetCount ? { ...g, progressPct: Math.round((week.cuts / g.targetCount) * 100), cutsThisWeek: week.cuts } : g),
  };
}

/**
 * Per chair (and its barber) at one location or all: revenue, cuts, average ticket,
 * utilization (minutes seated / 10-hour days worked) and rebooking rate. Done visits from `from` on.
 */
export function chairPerformance(d: ShopData, from: number, locationId?: string) {
  const all = scope(d, locationId);
  const rows = doneIn(all, from);
  const key = (b: ChairRequest) => `${b.locationId || HOME}::${b.seatLabel || b.chairLabel || "No chair"}`;
  const m = new Map<string, { chair: string; locationId: string; barber: string; cuts: number; sales: number; minutes: number; days: Set<string>; customers: Set<string>; returned: Set<string> }>();
  for (const b of rows) {
    const k = key(b);
    const r = m.get(k) ?? { chair: b.seatLabel || b.chairLabel || "No chair", locationId: b.locationId || HOME, barber: barberOf(d, b), cuts: 0, sales: 0, minutes: 0, days: new Set(), customers: new Set(), returned: new Set() };
    r.cuts++; r.sales += b.price || 0;
    if (b.startedAt && b.completedAt && b.completedAt > b.startedAt) r.minutes += Math.min(180, (b.completedAt - b.startedAt) / 60_000);
    r.days.add(manilaDay(b.completedAt ?? b.updatedAt));
    const c = who(b);
    if (c) { r.customers.add(c); if (all.some((o) => o !== b && who(o) === c && o.createdAt > b.createdAt && o.status !== "declined")) r.returned.add(c); }
    m.set(k, r);
  }
  // Chairs with no visits in the window still show (zeros), so idle chairs are visible.
  for (const c of d.chairs) {
    if (locationId && locationId !== "all" && c.locationId !== locationId) continue;
    const k = `${c.locationId}::${c.label}`;
    if (!m.has(k)) m.set(k, { chair: c.label, locationId: c.locationId, barber: c.barberName, cuts: 0, sales: 0, minutes: 0, days: new Set(), customers: new Set(), returned: new Set() });
  }
  const branchName = (id: string) => d.branches.find((b) => b.id === id)?.name ?? "";
  const chairs = [...m.values()].map((r) => ({
    chair: r.chair, barber: r.barber, locationId: r.locationId, location: branchName(r.locationId),
    cuts: r.cuts, salesCentavos: r.sales, avgTicketCentavos: r.cuts ? Math.round(r.sales / r.cuts) : 0,
    utilizationPct: r.days.size ? Math.round((r.minutes / (r.days.size * 600)) * 100) : null,
    rebookingPct: r.customers.size ? Math.round((r.returned.size / r.customers.size) * 100) : null,
  })).sort((a, b) => b.salesCentavos - a.salesCentavos || a.chair.localeCompare(b.chair));
  const sales = chairs.reduce((s, c) => s + c.salesCentavos, 0), cuts = chairs.reduce((s, c) => s + c.cuts, 0);
  return { chairs, totals: { salesCentavos: sales, cuts, avgTicketCentavos: cuts ? Math.round(sales / cuts) : 0 }, branches: d.branches };
}
