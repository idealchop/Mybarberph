"use client";
import type { ChairRequest } from "@/lib/chair-bookings";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import type { SalesRange } from "@/lib/sales-report";

const DAY = 86_400_000;
export const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export function rangeKeys(range: SalesRange, now = Date.now()) {
  const span = range === "today" ? 1 : range === "week" ? 7 : 28;
  return { span, keys: new Set(Array.from({ length: span }, (_, i) => dayKey(now - (span - 1 - i) * DAY))) };
}

export function inRange(rows: ChairRequest[], range: SalesRange, loc: string) {
  const { keys } = rangeKeys(range);
  const at = (r: ChairRequest) => r.completedAt ?? r.updatedAt ?? r.createdAt;
  return rows.filter((r) => (loc === "all" || (r.locationId || HOME_LOCATION_ID) === loc) && keys.has(dayKey(at(r))));
}

export interface LocStat {
  id: string; name: string; sales: number; cuts: number; avg: number; completionPct: number | null; cash: number; gcash: number; unpaid: number;
}
export interface ServiceStat {
  name: string; cuts: number; sales: number; avg: number; completionPct: number | null;
}
export interface BarberStat {
  id: string; name: string; locationId: string; locationName: string; sales: number; cuts: number; avg: number; cash: number; gcash: number; unpaid: number; remit: number; completionPct: number | null;
}

function doneAt(r: ChairRequest) { return r.completedAt ?? r.updatedAt ?? r.createdAt; }

/** All bookings that started or finished in the range (for completion rate). */
function scoped(rows: ChairRequest[], range: SalesRange, loc: string) {
  const { keys } = rangeKeys(range);
  return rows.filter((r) => (loc === "all" || (r.locationId || HOME_LOCATION_ID) === loc) && keys.has(dayKey(r.createdAt || doneAt(r))));
}

function completion(rows: ChairRequest[]) {
  const terminal = rows.filter((r) => r.status === "done" || r.status === "declined");
  if (!terminal.length) return null;
  return Math.round((terminal.filter((r) => r.status === "done").length / terminal.length) * 100);
}

export function locationStats(rows: ChairRequest[], range: SalesRange, branches: { id: string; name: string }[]): LocStat[] {
  return branches.map((b) => {
    const done = inRange(rows, range, b.id).filter((r) => r.status === "done");
    const sales = done.reduce((s, r) => s + (r.price || 0), 0);
    const cuts = done.length;
    let cash = 0, gcash = 0, unpaid = 0;
    for (const r of done) {
      if (!r.paid) unpaid += r.price || 0;
      else if (r.payMethod === "gcash") gcash += r.price || 0;
      else cash += r.price || 0;
    }
    return { id: b.id, name: b.name, sales, cuts, avg: cuts ? Math.round(sales / cuts) : 0, completionPct: completion(scoped(rows, range, b.id)), cash, gcash, unpaid };
  }).sort((a, b) => b.sales - a.sales);
}

export function serviceStats(rows: ChairRequest[], range: SalesRange, loc: string): ServiceStat[] {
  const done = inRange(rows, range, loc).filter((r) => r.status === "done");
  const all = scoped(rows, range, loc);
  const map = new Map<string, { cuts: number; sales: number; total: number; finished: number }>();
  for (const r of done) {
    const name = r.serviceName || "Service";
    const cur = map.get(name) ?? { cuts: 0, sales: 0, total: 0, finished: 0 };
    cur.cuts += 1; cur.sales += r.price || 0; cur.finished += 1; map.set(name, cur);
  }
  for (const r of all) {
    if (r.status !== "done" && r.status !== "declined") continue;
    const name = r.serviceName || "Service";
    const cur = map.get(name) ?? { cuts: 0, sales: 0, total: 0, finished: 0 };
    cur.total += 1; if (r.status === "done") cur.finished += 1; map.set(name, cur);
  }
  return [...map.entries()].map(([name, v]) => ({
    name, cuts: v.cuts, sales: v.sales, avg: v.cuts ? Math.round(v.sales / v.cuts) : 0,
    completionPct: v.total ? Math.round((v.finished / v.total) * 100) : null,
  })).sort((a, b) => b.sales - a.sales);
}

export function barberStats(rows: ChairRequest[], range: SalesRange, loc: string, branches: { id: string; name: string }[], chairs: { id: string; label: string; barberId?: string; barberName?: string; locationId?: string }[]): BarberStat[] {
  const done = inRange(rows, range, loc).filter((r) => r.status === "done");
  const nameOf = (id: string) => branches.find((b) => b.id === id)?.name || id;
  const map = new Map<string, BarberStat>();
  for (const r of done) {
    const bl = r.locationId || HOME_LOCATION_ID;
    const seat = chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || HOME_LOCATION_ID) === bl);
    const id = r.barberId || seat?.barberId || seat?.id || `seat:${bl}:${r.seatLabel || "-"}`;
    const name = r.barberName || seat?.barberName?.trim() || (r.seatLabel ? `${r.seatLabel}` : "No barber");
    const row = map.get(`${id}@${bl}`) ?? { id, name, locationId: bl, locationName: nameOf(bl), sales: 0, cuts: 0, avg: 0, cash: 0, gcash: 0, unpaid: 0, remit: 0, completionPct: null };
    row.cuts += 1; row.sales += r.price || 0;
    if (!r.paid) row.unpaid += r.price || 0;
    else if (r.payMethod === "gcash") row.gcash += r.price || 0;
    else row.cash += r.price || 0;
    row.remit = row.cash;
    map.set(`${id}@${bl}`, row);
  }
  for (const row of map.values()) {
    row.avg = row.cuts ? Math.round(row.sales / row.cuts) : 0;
    row.completionPct = completion(scoped(rows, range, row.locationId).filter((r) => {
      const seat = chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || HOME_LOCATION_ID) === row.locationId);
      const id = r.barberId || seat?.barberId || seat?.id || `seat:${row.locationId}:${r.seatLabel || "-"}`;
      return id === row.id;
    }));
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

type ChairLite = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string };
/** The barber key a visit counts toward (snapshot id, else the seat's barber). */
export function barberKey(r: ChairRequest, chairs: ChairLite[]) {
  const bl = r.locationId || HOME_LOCATION_ID;
  const seat = chairs.find((c) => c.label === (r.seatLabel || r.chairLabel) && (c.locationId || HOME_LOCATION_ID) === bl);
  return r.barberId || seat?.barberId || seat?.id || `seat:${bl}:${r.seatLabel || "-"}`;
}

/** Daily series for a detail trend chart (Manila days in range). */
export function dailySeries(rows: ChairRequest[], range: SalesRange, loc: string, keep: (r: ChairRequest) => boolean = () => true) {
  const { span } = rangeKeys(range);
  const now = Date.now();
  const days = Array.from({ length: span }, (_, i) => {
    const ms = now - (span - 1 - i) * DAY;
    return { key: dayKey(ms), label: new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }), sales: 0, cuts: 0 };
  });
  const index = new Map(days.map((d) => [d.key, d]));
  for (const r of inRange(rows, range, loc).filter((x) => x.status === "done" && keep(x))) {
    const d = index.get(dayKey(doneAt(r)));
    if (d) { d.sales += r.price || 0; d.cuts += 1; }
  }
  return days;
}

/** Minutes with a customer (start → done) for visits that recorded both. */
export function busyMinutes(rows: ChairRequest[]) {
  return Math.round(rows.reduce((m, r) => m + (r.status === "done" && r.startedAt && r.completedAt && r.completedAt > r.startedAt ? Math.min(240, (r.completedAt - r.startedAt) / 60000) : 0), 0));
}
