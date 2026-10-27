import "server-only";
import type { ChairRequest } from "@/lib/booking-types";
import { loadState, shopRef } from "@/lib/server/shops";
import { cutBarberId, UNASSIGNED, UNASSIGNED_NAME } from "@/lib/cut-count";

/**
 * Read-only view of one owner's shop for the Companion. Nothing here writes business data.
 * Money is returned in pesos (bookings store centavos).
 */
export interface ShopData {
  shopName: string;
  plan: string;
  bookings: ChairRequest[];
  /** The shop's barbers (stored under "barbers.shop-chairs", the app's only barber list; each record is one barber). */
  barbers: { id: string; barberId: string; barberName: string; locationId: string }[];
  branches: { id: string; name: string }[];
}

const DAY = 86_400_000;
const HOME = "home";
export const pesos = (c: number) => Math.round(c) / 100;

export function manilaDay(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export async function loadShopData(shopId: string, shopName: string, plan: string): Promise<ShopData> {
  const since = Date.now() - 120 * DAY;
  const col = shopRef(shopId).collection("bookings");
  // Same reads as Sales: recent tickets by creation, plus anything finished in the window (an old ticket finished today still counts today).
  const [snap, doneSnap, state] = await Promise.all([
    col.where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(5000).get(),
    col.where("completedAt", ">=", since).orderBy("completedAt", "desc").limit(5000).get(),
    loadState(shopId, ["barbers.shop-chairs", "barbers.shop-locations", "barbers.shop-profile"]),
  ]);
  const parse = (k: string) => { try { return JSON.parse(state[k] || "null"); } catch { return null; } };
  // "barbers.shop-chairs" is the app's barber list (the same records Sales reads); a visit belongs only to its barberId, else Unassigned, exactly as Sales does (src/lib/cut-count.ts).
  const barbersRaw = parse("barbers.shop-chairs");
  const locRaw = parse("barbers.shop-locations");
  const profile = parse("barbers.shop-profile");
  const barbers = (Array.isArray(barbersRaw) ? barbersRaw : [])
    .map((c: Record<string, unknown>) => ({ id: String(c.id ?? ""), barberId: String(c.barberId ?? ""), barberName: String(c.barberName ?? "").trim(), locationId: String(c.locationId ?? HOME) }))
    .filter((c: { barberName: string }) => c.barberName);
  const branchesRaw = locRaw && Array.isArray(locRaw.branches) ? locRaw.branches : [];
  const branches = branchesRaw.length
    ? branchesRaw.map((b: Record<string, unknown>) => ({ id: String(b.id ?? HOME), name: String(b.name ?? "Shop") }))
    : [{ id: HOME, name: shopName || profile?.name || "Main shop" }];
  return { shopName: shopName || profile?.name || "your shop", plan, bookings: mergeBookings([...snap.docs, ...doneSnap.docs].map((d) => ({ ...(d.data() as ChairRequest), id: d.id }))), barbers, branches };
}

/** One row per ticket (the two reads overlap). */
export function mergeBookings(rows: ChairRequest[]): ChairRequest[] {
  const seen = new Map<string, ChairRequest>();
  for (const r of rows) { const k = String((r as { id?: string }).id ?? ""); if (!k) { seen.set(`_${seen.size}`, r); continue; } if (!seen.has(k)) seen.set(k, r); }
  return [...seen.values()];
}

/** Accepts a branch id or its name (the model often passes "San Antonio"); unknown → whole shop, never an empty filter. */
export function resolveLocation(d: ShopData, locationId?: string): string | undefined {
  if (!locationId || locationId === "all") return undefined;
  const raw = String(locationId).trim(), low = raw.toLowerCase();
  const hit = d.branches.find((b) => b.id === raw) ?? d.branches.find((b) => b.name.toLowerCase() === low)
    ?? d.branches.find((b) => b.name.toLowerCase().includes(low) || low.includes(b.name.toLowerCase()));
  return hit?.id;
}
function scope(d: ShopData, locationId?: string) {
  const id = resolveLocation(d, locationId);
  if (!id) return d.bookings;
  // Single-shop accounts store visits without a location (= home).
  return d.bookings.filter((b) => (b.locationId || HOME) === id || (d.branches.length === 1 && !b.locationId));
}
/** Finished cuts in [from, to), by completion time (same rule as Sales: only status "done", counted on completedAt). */
const doneIn = (rows: ChairRequest[], from: number, to = Date.now() + 1) =>
  rows.filter((b) => b.status === "done" && (b.completedAt ?? b.updatedAt) >= from && (b.completedAt ?? b.updatedAt) < to);
const doneAt = (b: ChairRequest) => b.completedAt ?? b.updatedAt;
const total = (rows: ChairRequest[]) => pesos(rows.reduce((s, b) => s + (b.price || 0), 0));
const clampDays = (n: unknown, def = 7) => Math.max(1, Math.min(120, Math.round(Number(n) || def)));
const who = (b: ChairRequest) => (b.contact || b.customerLabel || "").trim().toLowerCase();
/** The barber on a visit, with the shared Sales rule (cutBarberId), then its saved barber name. */
export function barberOf(d: ShopData, b: ChairRequest) {
  const loc = b.locationId || HOME;
  if (b.barberId === "owner") return b.barberName?.trim() || "Owner";
  const id = cutBarberId(b);
  if (!b.barberId) return id === UNASSIGNED ? UNASSIGNED_NAME : b.barberName!.trim();
  const match = (x: ShopData["barbers"][number]) => (x.barberId || x.id) === id || x.id === id;
  const byId = d.barbers.find((x) => match(x) && x.locationId === loc) ?? d.barbers.find(match);
  if (byId?.barberName) return byId.barberName;
  return b.barberName?.trim() || UNASSIGNED_NAME;
}

/** Calendar-aligned like the Sales screen: "N days" = today plus the N-1 Manila days before it. */
export function windowStart(days: number, now = Date.now()) {
  return Date.parse(`${manilaDay(now)}T00:00:00+08:00`) - (days - 1) * DAY;
}

export function getSales(d: ShopData, a: { days?: number; locationId?: string }) {
  const days = clampDays(a.days);
  const unknownBranch = !!a.locationId && a.locationId !== "all" && !resolveLocation(d, a.locationId);
  const rows = scope(d, a.locationId);
  const now = Date.now();
  const start = windowStart(days, now);
  const cur = doneIn(rows, start, now + 1);
  const prev = doneIn(rows, start - days * DAY, start);
  const byDay: Record<string, { sales: number; cuts: number }> = {};
  for (const b of cur) { const k = manilaDay(b.completedAt ?? b.updatedAt); byDay[k] ??= { sales: 0, cuts: 0 }; byDay[k].sales += pesos(b.price); byDay[k].cuts++; }
  const unpaid = rows.filter((b) => b.status === "done" && !b.paid && (b.completedAt ?? b.updatedAt) >= start);
  const s = total(cur);
  return { days, period: `${manilaDay(start)} to ${manilaDay(now)} (Manila)`, branch: unknownBranch ? `unknown branch "${a.locationId}"; these are ALL branches` : resolveLocation(d, a.locationId) ? d.branches.find((b) => b.id === resolveLocation(d, a.locationId))?.name : "all branches", salesPhp: s, cuts: cur.length, avgTicketPhp: cur.length ? Math.round(s / cur.length) : 0, previousPeriodSalesPhp: total(prev), previousPeriodCuts: prev.length, unpaidPhp: total(unpaid), byDay };
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
  const rows = doneIn(scope(d, a.locationId), windowStart(days));
  const m = new Map<string, { service: string; cuts: number; salesPhp: number }>();
  for (const b of rows) { const k = b.serviceName || "Service"; const r = m.get(k) ?? { service: k, cuts: 0, salesPhp: 0 }; r.cuts++; r.salesPhp += pesos(b.price); m.set(k, r); }
  return { days, services: [...m.values()].sort((x, y) => y.salesPhp - x.salesPhp).slice(0, Math.max(1, Math.min(20, a.limit ?? 10))) };
}

/** Per-barber revenue, cuts, average ticket, days worked and rebooking rate. */
export function staffPerformance(d: ShopData, a: { days?: number; locationId?: string }) {
  const days = clampDays(a.days, 30);
  const all = scope(d, a.locationId);
  const now = Date.now();
  const from = windowStart(days, now);
  const rows = doneIn(all, from, now + 1);
  const branchName = (id: string) => d.branches.find((b) => b.id === id)?.name ?? "";
  const m = new Map<string, { barber: string; branch: string; cuts: number; salesPhp: number; customers: Set<string>; returned: Set<string>; days: Set<string> }>();
  for (const b of rows) {
    const name = barberOf(d, b), loc = b.locationId || HOME;
    const k = `${name}@${loc}`;
    const r = m.get(k) ?? { barber: name, branch: branchName(loc), cuts: 0, salesPhp: 0, customers: new Set(), returned: new Set(), days: new Set() };
    r.cuts++; r.salesPhp += pesos(b.price);
    r.days.add(manilaDay(b.completedAt ?? b.updatedAt));
    const c = who(b);
    if (c) {
      if (all.some((o) => o !== b && who(o) === c && o.createdAt > b.createdAt && o.status !== "declined")) r.returned.add(c);
      r.customers.add(c);
    }
    m.set(k, r);
  }
  return {
    days, period: `${manilaDay(from)} to ${manilaDay(now)} (Manila, ${days === 1 ? "today only" : `today and the ${days - 1} days before`})`,
    branch: resolveLocation(d, a.locationId) ? branchName(resolveLocation(d, a.locationId)!) : "all branches (one row per barber per branch)",
    barbers: [...m.values()].map((r) => ({
      barber: r.barber, branch: r.branch, cuts: r.cuts, salesPhp: r.salesPhp, avgTicketPhp: r.cuts ? Math.round(r.salesPhp / r.cuts) : 0,
      daysWorked: r.days.size,
      rebookingRatePct: r.customers.size ? Math.round((r.returned.size / r.customers.size) * 100) : null, knownCustomers: r.customers.size,
    })).sort((x, y) => y.salesPhp - x.salesPhp),
    note: "Rebooking = known customers who came back after a visit with this barber.",
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
 * Per barber at one location or all: revenue, cuts, average ticket and rebooking rate.
 * Done visits from `from` on. Barbers with no visits in the window still show (zeros).
 */
export function barberPerformance(d: ShopData, from: number, locationId?: string) {
  const all = scope(d, locationId);
  const rows = doneIn(all, from);
  const m = new Map<string, { barber: string; locationId: string; cuts: number; sales: number; customers: Set<string>; returned: Set<string> }>();
  for (const b of rows) {
    const barber = barberOf(d, b), loc = b.locationId || HOME, k = `${loc}::${barber}`;
    const r = m.get(k) ?? { barber, locationId: loc, cuts: 0, sales: 0, customers: new Set(), returned: new Set() };
    r.cuts++; r.sales += b.price || 0;
    const c = who(b);
    if (c) { r.customers.add(c); if (all.some((o) => o !== b && who(o) === c && o.createdAt > b.createdAt && o.status !== "declined")) r.returned.add(c); }
    m.set(k, r);
  }
  const want = resolveLocation(d, locationId);
  for (const x of d.barbers) {
    if (want && x.locationId !== want) continue;
    const k = `${x.locationId}::${x.barberName}`;
    if (!m.has(k)) m.set(k, { barber: x.barberName, locationId: x.locationId, cuts: 0, sales: 0, customers: new Set(), returned: new Set() });
  }
  const branchName = (id: string) => d.branches.find((b) => b.id === id)?.name ?? "";
  const barbers = [...m.values()].map((r) => ({
    barber: r.barber, locationId: r.locationId, location: branchName(r.locationId),
    cuts: r.cuts, salesCentavos: r.sales, avgTicketCentavos: r.cuts ? Math.round(r.sales / r.cuts) : 0,
    rebookingPct: r.customers.size ? Math.round((r.returned.size / r.customers.size) * 100) : null,
  })).sort((a, b) => b.salesCentavos - a.salesCentavos || a.barber.localeCompare(b.barber));
  const sales = barbers.reduce((s, c) => s + c.salesCentavos, 0), cuts = barbers.reduce((s, c) => s + c.cuts, 0);
  return { barbers, totals: { salesCentavos: sales, cuts, avgTicketCentavos: cuts ? Math.round(sales / cuts) : 0 }, branches: d.branches };
}

/** Monday 00:00 Manila of the week containing `now` (weeks run Monday to Sunday, like the profit report). */
export function weekStart(now = Date.now()) {
  const today = Date.parse(`${manilaDay(now)}T00:00:00+08:00`);
  const dow = (new Date(today + 8 * 3600_000).getUTCDay() + 6) % 7;
  return today - dow * DAY;
}

/**
 * Fixed figures for the chat context: today and this week (Mon–Sun), per branch and shop total,
 * and every barber's numbers per branch. Finished cuts only, counted on their Manila completion day.
 */
export function scoreboard(d: ShopData, now = Date.now()) {
  const today = Date.parse(`${manilaDay(now)}T00:00:00+08:00`);
  const week = weekStart(now);
  const end = now + 1;
  const multi = d.branches.length > 1;
  const inBranch = (b: ChairRequest, id: string) => (b.locationId || HOME) === id || (!multi && !b.locationId);
  const sum = (rows: ChairRequest[]) => ({ cuts: rows.length, salesPhp: total(rows) });
  const done = doneIn(d.bookings, week, end);
  const isToday = (b: ChairRequest) => doneAt(b) >= today;
  const branches = d.branches.map((br) => {
    const rows = done.filter((b) => inBranch(b, br.id));
    const m = new Map<string, ChairRequest[]>();
    for (const b of rows) { const k = barberOf(d, b); m.set(k, [...(m.get(k) ?? []), b]); }
    for (const c of d.barbers) if (inBranch({ locationId: c.locationId } as ChairRequest, br.id) && !m.has(c.barberName)) m.set(c.barberName, []);
    return {
      branch: br.name, locationId: br.id, today: sum(rows.filter(isToday)), thisWeek: sum(rows),
      barbers: [...m].map(([barber, list]) => ({ barber, today: sum(list.filter(isToday)), thisWeek: sum(list) })).sort((x, y) => y.today.cuts - x.today.cuts || y.thisWeek.cuts - x.thisWeek.cuts),
    };
  });
  return {
    todayDate: manilaDay(now), weekFrom: manilaDay(week), weekTo: manilaDay(week + 6 * DAY),
    total: { today: sum(done.filter(isToday)), thisWeek: sum(done) }, branches,
  };
}

/** Plain-text scoreboard for the system context. */
export function scoreboardText(d: ShopData, now = Date.now()) {
  const s = scoreboard(d, now);
  const f = (x: { cuts: number; salesPhp: number }) => `${x.cuts} cuts, ₱${x.salesPhp.toLocaleString("en-PH")}`;
  const lines = [
    `Finished cuts only, counted on the Manila day they were completed. TODAY = ${s.todayDate}. THIS WEEK = ${s.weekFrom} (Mon) to ${s.weekTo} (Sun), so far.`,
    `WHOLE SHOP (all branches combined): today ${f(s.total.today)}; this week ${f(s.total.thisWeek)}.`,
  ];
  for (const b of s.branches) {
    lines.push(`BRANCH ${b.branch} (id ${b.locationId}): today ${f(b.today)}; this week ${f(b.thisWeek)}.`);
    for (const r of b.barbers) lines.push(`  - ${r.barber} at ${b.branch}: today ${f(r.today)}; this week ${f(r.thisWeek)}.`);
  }
  return lines.join("\n");
}
