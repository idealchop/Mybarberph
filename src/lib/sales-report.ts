"use client";

import type { ChairRequest } from "@/lib/chair-bookings";
import { periodBounds } from "@/lib/barber-sales";
import { splitTotals } from "@/lib/income-split";
import { PAY_LABEL, payBucket, paySplit, type PaySplit } from "@/lib/pay-split";

export type SalesRange = "today" | "week" | "d30" | "month" | "all" | "custom";

export const SALES_RANGES: { value: SalesRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7d" },
  { value: "all", label: "All time" },
];

/** Same chips on owner Sales and a barber's My sales. Today is the daily view. */
export const DAY_RANGES: { value: SalesRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "d30", label: "30 days" },
  { value: "month", label: "Month" },
];

let earliest = 0;
/** Oldest visit seen (ms); "All time" spans from its Manila day to today. */
export function noteEarliest(rows: { createdAt?: number; completedAt?: number; updatedAt?: number }[]) {
  for (const r of rows) { const t = Math.min(r.createdAt || Infinity, r.completedAt || Infinity, r.updatedAt || Infinity); if (Number.isFinite(t) && t > 0 && (!earliest || t < earliest)) earliest = t; }
}
/** How many days of rows a range needs from the server. */
export function rangeFetchDays(range: SalesRange) {
  if (range === "all") return 3650;
  if (range === "custom") return 124;
  if (range === "d30" || range === "month") return 40;
  if (range === "week") return 10;
  return 3;
}

let custom: { from: string; to: string } | null = null;
/** Sets the dates used when the range is "custom" (YYYY-MM-DD, Manila, inclusive). */
export function setCustomRange(from: string, to: string) { custom = from && to ? (from <= to ? { from, to } : { from: to, to: from }) : null; }
export function getCustomRange() { return custom; }
/** Last instant of the range and how many Manila days it covers. Days match `periodBounds`. */
export function rangeWindow(range: SalesRange, now = Date.now()) {
  if (range === "all") {
    const end = periodBounds("today", now).to;
    const from = earliest ? Date.parse(`${new Date(earliest + 8 * 3600_000).toISOString().slice(0, 10)}T00:00:00+08:00`) : end - 28 * 86_400_000;
    return { end: end - 1, span: Math.max(1, Math.min(3650, Math.round((end - from) / 86_400_000))) };
  }
  const b = periodBounds(range, now, custom);
  return { end: b.to - 1, span: Math.max(1, Math.round((b.to - b.from) / 86_400_000)) };
}

export interface SalesRow {
  label: string;
  orders: number;
  salesCentavos: number;
  detail: string;
}

export interface SalesReport {
  delta: string;
  sales: number;
  cuts: number;
  collected: number;
  /** Collected money by stored payment method (no method = other). */
  collectedSplit: PaySplit;
  /** Collected money split by each barber's income split (only when pctOf is given). */
  collectedShares?: { total: number; shop: number; barber: number; none: number };
  unpaid: number;
  average: number;
  series: SalesRow[];
  seriesKind: "hour" | "day";
  services: SalesRow[];
  payments: SalesRow[];
  channels: SalesRow[];
  barbers: SalesRow[];
  chairs: SalesRow[];
  customers: number;
  recent: { id: string; who: string; service: string; sales: number; paid: boolean; when: string }[];
}


function hourOf(ms: number) {
  const raw = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" })
    .formatToParts(new Date(ms))
    .find((part) => part.type === "hour")?.value ?? "0";
  const hour = Number(raw);
  return hour === 24 ? 0 : hour;
}

function hourLabel(hour: number) {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

function whenLabel(ms: number) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

function row(label: string, orders: number, salesCentavos: number): SalesRow {
  const cuts = orders > 0 ? `${orders} ${orders === 1 ? "haircut" : "haircuts"}` : "Shop total";
  return { label, orders, salesCentavos, detail: cuts };
}

function add(map: Map<string, { orders: number; sales: number }>, label: string, orders: number, sales: number) {
  const cur = map.get(label) ?? { orders: 0, sales: 0 };
  cur.orders += orders;
  cur.sales += sales;
  map.set(label, cur);
}

function rowsFrom(map: Map<string, { orders: number; sales: number }>) {
  return [...map.entries()]
    .map(([label, value]) => row(label, value.orders, value.sales))
    .filter((item) => item.orders > 0 || item.salesCentavos > 0)
    .sort((a, b) => b.salesCentavos - a.salesCentavos || b.orders - a.orders);
}

const DAY_MS = 86_400_000;

function dayKey(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function dayLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
}

/** Sales from this shop's finished visits (Manila days). `rows` is every visit in scope. */
export function salesReport(rows: ChairRequest[], _unpaidInRange: number, range: SalesRange, pctOf?: (r: ChairRequest) => number | null): SalesReport {
  const { end: now, span } = rangeWindow(range);
  const keys = Array.from({ length: span }, (_, i) => dayKey(now - (span - 1 - i) * DAY_MS));
  const prevKeys = new Set(Array.from({ length: span }, (_, i) => dayKey(now - (2 * span - 1 - i) * DAY_MS)));
  const inRange = new Set(keys);
  const done = rows.filter((r) => r.status === "done");
  const doneAt = (r: ChairRequest) => r.completedAt || 0;
  const extras = done.filter((r) => inRange.has(dayKey(doneAt(r))));
  const previous = done.filter((r) => prevKeys.has(dayKey(doneAt(r))));
  const rangeSales = extras.reduce((sum, item) => sum + item.price, 0);
  const previousSales = previous.reduce((sum, item) => sum + item.price, 0);
  const cuts = extras.length;

  const services = new Map<string, { orders: number; sales: number }>();
  const payments = new Map<string, { orders: number; sales: number }>();
  const channels = new Map<string, { orders: number; sales: number }>();
  const byChair = new Map<string, { orders: number; sales: number }>();
  const hours = new Map<number, { orders: number; sales: number }>();
  const days = new Map<string, { orders: number; sales: number }>();
  const names = new Set<string>();

  for (const extra of extras) {
    add(services, extra.serviceName || "Service", 1, extra.price);
    add(payments, extra.paid ? PAY_LABEL[payBucket(extra)] : "Still unpaid", 1, extra.price);
    add(channels, extra.channel === "online" ? "Online" : "Walk-in", 1, extra.price);
    const chair = extra.seatLabel || extra.chairLabel;
    if (chair) add(byChair, chair, 1, extra.price);
    const at = doneAt(extra);
    const hour = hourOf(at);
    const bucket = hours.get(hour) ?? { orders: 0, sales: 0 };
    bucket.orders += 1;
    bucket.sales += extra.price;
    hours.set(hour, bucket);
    const d = days.get(dayKey(at)) ?? { orders: 0, sales: 0 };
    d.orders += 1;
    d.sales += extra.price;
    days.set(dayKey(at), d);
    names.add(extra.contact || extra.customerLabel || extra.id);
  }

  const series: SalesRow[] = span === 1
    ? [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([hour, value]) => row(hourLabel(hour), value.orders, value.sales))
    : keys.map((k, i) => {
      const v = days.get(k) ?? { orders: 0, sales: 0 };
      return row(dayLabel(now - (span - 1 - i) * DAY_MS), v.orders, v.sales);
    });

  const recent = extras
    .map((item) => ({ id: item.id, who: item.customerLabel || item.contact || "Walk-in", service: item.serviceName, sales: item.price, paid: Boolean(item.paid), at: doneAt(item) }))
    .sort((a, b) => b.at - a.at).slice(0, 6)
    .map(({ id, who, service, sales, paid, at }) => ({ id, who, service, sales, paid, when: whenLabel(at) }));

  const delta = rangeSales === 0
    ? "No sales yet"
    : previousSales > 0
      && range !== "all" ? `${rangeSales >= previousSales ? "+" : "−"}${Math.round((Math.abs(rangeSales - previousSales) / previousSales) * 100)}% vs previous ${span === 1 ? "day" : `${span} days`}`
      : range === "all" ? "All time" : "First sales on record";

  return {
    delta,
    sales: rangeSales,
    cuts,
    collected: extras.filter((r) => r.paid).reduce((sum, r) => sum + r.price, 0),
    collectedSplit: paySplit(extras),
    collectedShares: pctOf ? splitTotals(extras.filter((r) => r.paid).map((r) => ({ amount: r.price, pct: pctOf(r) }))) : undefined,
    unpaid: extras.filter((r) => !r.paid).reduce((sum, r) => sum + r.price, 0),
    average: cuts > 0 ? Math.round(rangeSales / cuts) : 0,
    series,
    seriesKind: span === 1 ? "hour" : "day",
    services: rowsFrom(services),
    payments: rowsFrom(payments),
    channels: rowsFrom(channels),
    barbers: [],
    chairs: rowsFrom(byChair),
    customers: names.size,
    recent,
  };
}
