"use client";
import type { ChairRequest } from "@/lib/chair-bookings";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import { rangeWindow, type SalesRange } from "@/lib/sales-report";
import { cutBarberId } from "@/lib/cut-count";
import { addToSplit, payBucket } from "@/lib/pay-split";

const DAY = 86_400_000;
export const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export function rangeKeys(range: SalesRange) {
  const { end: now, span } = rangeWindow(range);
  return { span, keys: new Set(Array.from({ length: span }, (_, i) => dayKey(now - (span - 1 - i) * DAY))) };
}

export function inRange(rows: ChairRequest[], range: SalesRange, loc: string) {
  const { keys } = rangeKeys(range);
  const at = (r: ChairRequest) => (r.status === "done" ? r.completedAt || 0 : r.completedAt ?? r.updatedAt ?? r.createdAt);
  return rows.filter((r) => (loc === "all" || (r.locationId || HOME_LOCATION_ID) === loc) && keys.has(dayKey(at(r))));
}

export interface LocStat {
  id: string; name: string; sales: number; cuts: number; avg: number; completionPct: number | null; cash: number; gcash: number; online: number; other: number; unpaid: number;
}
export interface ServiceStat {
  name: string; cuts: number; sales: number; avg: number; completionPct: number | null;
}
export interface BarberStat {
  id: string; name: string; locationId: string; locationName: string; sales: number; cuts: number; avg: number; cash: number; gcash: number; online: number; other: number; unpaid: number;
  /** Cash to hand over: cash visits plus paid visits with no stored method (same rule as lib/server/remit.ts). */
  remit: number; completionPct: number | null;
  /** Average customer rating (1–5) for rated cuts in range, and how many. */
  rating: number | null; ratings: number;
}

function doneAt(r: ChairRequest) { return r.status === "done" ? r.completedAt || 0 : r.completedAt ?? r.updatedAt ?? r.createdAt; }

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
    const split = { cash: 0, gcash: 0, online: 0, other: 0 };
    let unpaid = 0;
    for (const r of done) {
      if (!r.paid) unpaid += r.price || 0;
      else addToSplit(split, r);
    }
    return { id: b.id, name: b.name, sales, cuts, avg: cuts ? Math.round(sales / cuts) : 0, completionPct: completion(scoped(rows, range, b.id)), ...split, unpaid };
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
    const id = cutBarberId(r, chairs);
    const name = r.barberName || seat?.barberName?.trim() || (r.seatLabel ? `${r.seatLabel}` : "No barber");
    const row = map.get(`${id}@${bl}`) ?? { id, name, locationId: bl, locationName: nameOf(bl), sales: 0, cuts: 0, avg: 0, cash: 0, gcash: 0, online: 0, other: 0, unpaid: 0, remit: 0, completionPct: null, rating: null, ratings: 0 };
    row.cuts += 1; row.sales += r.price || 0;
    if (!r.paid) row.unpaid += r.price || 0;
    else {
      addToSplit(row, r);
      const k = payBucket(r);
      if (k === "cash" || k === "other") row.remit += r.price || 0;
    }
    if (r.rating && r.rating > 0) { row.rating = ((row.rating ?? 0) * row.ratings + r.rating) / (row.ratings + 1); row.ratings += 1; }
    map.set(`${id}@${bl}`, row);
  }
  for (const row of map.values()) {
    row.avg = row.cuts ? Math.round(row.sales / row.cuts) : 0;
    row.completionPct = completion(scoped(rows, range, row.locationId).filter((r) => {
      const id = cutBarberId(r, chairs);
      return id === row.id;
    }));
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

type ChairLite = { id: string; label: string; barberId?: string; barberName?: string; locationId?: string };
/** The barber key a visit counts toward (snapshot id, else the seat's barber). */
export function barberKey(r: ChairRequest, chairs: ChairLite[]) {
  return cutBarberId(r, chairs);
}

/** Daily series for a detail trend chart (Manila days in range). */
export function dailySeries(rows: ChairRequest[], range: SalesRange, loc: string, keep: (r: ChairRequest) => boolean = () => true) {
  const { end: now, span } = rangeWindow(range);
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

/**
 * Ranking rows to show. A turned-off barber is hidden only at the location where their chair is off, and only
 * when they have no sales in the range, so the ranking always adds up to the Sales total.
 */
export function rankedBarbers(rows: BarberStat[], chairs: { id: string; barberId?: string; locationId?: string; active?: boolean }[]): BarberStat[] {
  const off = new Set(chairs.filter((c) => c.active === false).map((c) => `${c.barberId || c.id}@${c.locationId || HOME_LOCATION_ID}`));
  return rows.filter((b) => b.cuts > 0 || !off.has(`${b.id}@${b.locationId}`));
}
