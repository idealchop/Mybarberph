"use client";

import type { ChairRequest } from "@/lib/chair-bookings";

export type SalesRange = "today" | "week" | "month" | "all" | "custom";
export type SalesView = "overview" | "services" | "payments" | "shop";

export const SALES_RANGES: { value: SalesRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7d" },
  { value: "all", label: "All time" },
];

let earliest = 0;
/** Oldest visit seen (ms); "All time" spans from its Manila day to today. */
export function noteEarliest(rows: { createdAt?: number; completedAt?: number; updatedAt?: number }[]) {
  for (const r of rows) { const t = Math.min(r.createdAt || Infinity, r.completedAt || Infinity, r.updatedAt || Infinity); if (Number.isFinite(t) && t > 0 && (!earliest || t < earliest)) earliest = t; }
}
/** How many days of rows a range needs from the server. */
export function rangeFetchDays(range: SalesRange) { return range === "all" ? 3650 : range === "custom" ? 124 : 28; }

let custom: { from: string; to: string } | null = null;
/** Sets the dates used when the range is "custom" (YYYY-MM-DD, Manila, inclusive). */
export function setCustomRange(from: string, to: string) { custom = from && to ? (from <= to ? { from, to } : { from: to, to: from }) : null; }
/** End time (noon of the last Manila day) and number of days for a range. */
export function rangeWindow(range: SalesRange, now = Date.now()) {
  if (range === "custom" && custom) {
    const f = Date.parse(`${custom.from}T12:00:00+08:00`), t = Date.parse(`${custom.to}T12:00:00+08:00`);
    return { end: Math.min(t, now), span: Math.max(1, Math.min(62, Math.round((Math.min(t, now) - f) / 86_400_000) + 1)) };
  }
  if (range === "all") return { end: now, span: Math.max(1, Math.min(3650, earliest ? Math.ceil((now - earliest) / 86_400_000) + 1 : 28)) };
  return { end: now, span: range === "today" ? 1 : range === "week" ? 7 : 28 };
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
  const cuts = orders > 0 ? `${orders} ${orders === 1 ? "cut" : "cuts"}` : "Shop total";
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
export function salesReport(rows: ChairRequest[], unpaidCentavos: number, range: SalesRange): SalesReport {
  const { end: now, span } = rangeWindow(range);
  const keys = Array.from({ length: span }, (_, i) => dayKey(now - (span - 1 - i) * DAY_MS));
  const prevKeys = new Set(Array.from({ length: span }, (_, i) => dayKey(now - (2 * span - 1 - i) * DAY_MS)));
  const inRange = new Set(keys);
  const done = rows.filter((r) => r.status === "done");
  const doneAt = (r: ChairRequest) => r.completedAt ?? r.updatedAt;
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
    add(payments, extra.paid ? ({ cash: "Cash", gcash: "GCash", online: "Online" } as const)[extra.payMethod ?? (extra.payWhere === "online" ? "online" : "cash")] : "Still unpaid", 1, extra.price);
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
    unpaid: unpaidCentavos,
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
