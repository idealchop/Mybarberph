"use client";

import { chairs, salesSummary, transactions } from "@/data";
import { barberStatsToday, dailySales, dailySalesEarlier } from "@/data/mock/seed";
import type { ChairRequest } from "@/lib/chair-bookings";

export type SalesRange = "today" | "week" | "month";
export type SalesView = "overview" | "services" | "payments" | "shop";

export const SALES_RANGES: { value: SalesRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
];

const BARBER_NAMES: Record<string, string> = {
  "b-caloy": "Caloy",
  "b-ruben": "Ruben",
  "b-tin": "Tin",
  "b-jm": "JM",
};

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
  recent: { id: string; who: string; service: string; sales: number; when: string }[];
}

const PAY: Record<string, string> = { cash: "Cash", gcash: "GCash", maya: "Maya", card: "Card" };
const DAYS = [...dailySalesEarlier, ...dailySales];

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

/** Sales for the shop that is open. The sample day is the shop total. New finished cuts add on top. */
export function salesReport(extras: ChairRequest[], unpaidCentavos: number, includeSeed: boolean, range: SalesRange): SalesReport {
  const extraSales = extras.reduce((sum, item) => sum + item.price, 0);
  const todaySales = (includeSeed ? salesSummary.sales : 0) + extraSales;
  const todayCuts = (includeSeed ? salesSummary.transactions : 0) + extras.length;

  const span = range === "month" ? DAYS.length : 7;
  const currentDays = DAYS.slice(-span);
  const previousDays = DAYS.slice(-(span * 2), -span);
  const rangeSales = range === "today" || !includeSeed
    ? todaySales
    : currentDays.reduce((sum, day) => sum + day.sales, 0) - salesSummary.sales + todaySales;
  const previousSales = previousDays.reduce((sum, day) => sum + day.sales, 0);

  const services = new Map<string, { orders: number; sales: number }>();
  const payments = new Map<string, { orders: number; sales: number }>();
  const channels = new Map<string, { orders: number; sales: number }>();
  const byBarber = new Map<string, { orders: number; sales: number }>();
  const byChair = new Map<string, { orders: number; sales: number }>();
  const hours = new Map<number, { orders: number; sales: number }>();
  const names = new Set<string>();

  if (includeSeed) {
    for (const mix of salesSummary.paymentMix) add(payments, PAY[mix.method] ?? mix.method, 0, mix.amount);
    for (const [id, stat] of Object.entries(barberStatsToday)) add(byBarber, BARBER_NAMES[id] ?? "Barber", stat.cuts, stat.sales);
    add(channels, "Walk-in", salesSummary.walkIns, 0);
    add(channels, "Online", salesSummary.online, 0);
    for (const tx of transactions) {
      add(services, tx.serviceLabel, 1, tx.total);
      const hour = hourOf(new Date(tx.completedAt).getTime());
      const bucket = hours.get(hour) ?? { orders: 0, sales: 0 };
      bucket.orders += 1;
      bucket.sales += tx.total;
      hours.set(hour, bucket);
      add(byChair, chairs.find((chair) => chair.id === tx.chairId)?.label ?? "Chair", 1, tx.total);
      names.add(tx.customerName);
    }
  }

  for (const extra of extras) {
    add(services, extra.serviceName, 1, extra.price);
    if (extra.paid) add(payments, extra.payWhere === "online" ? "GCash" : "Cash", 1, extra.price);
    add(channels, extra.channel === "online" ? "Online" : "Walk-in", 1, extra.price);
    const chair = extra.seatLabel || extra.chairLabel;
    if (chair) add(byChair, chair, 1, extra.price);
    if (extra.completedAt) {
      const hour = hourOf(extra.completedAt);
      const bucket = hours.get(hour) ?? { orders: 0, sales: 0 };
      bucket.orders += 1;
      bucket.sales += extra.price;
      hours.set(hour, bucket);
    }
    names.add(extra.customerLabel || extra.contact || "Walk-in");
  }
  if (unpaidCentavos > 0) add(payments, "Still unpaid", 0, unpaidCentavos);

  const series: SalesRow[] = range === "today" || !includeSeed
    ? [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([hour, value]) => row(hourLabel(hour), value.orders, value.sales))
    : currentDays.map((day, index) => {
      const last = index === currentDays.length - 1;
      const amount = last ? day.sales - salesSummary.sales + todaySales : day.sales;
      return row(day.label, last ? todayCuts : 0, amount);
    });

  const recent = [
    ...extras.map((item) => ({
      id: item.id,
      who: item.customerLabel || item.contact || "Walk-in",
      service: item.serviceName,
      sales: item.price,
      at: item.completedAt ?? 0,
    })),
    ...(includeSeed ? transactions.map((tx) => ({
      id: tx.id,
      who: tx.customerName,
      service: tx.serviceLabel,
      sales: tx.total,
      at: new Date(tx.completedAt).getTime(),
    })) : []),
  ].sort((a, b) => b.at - a.at).slice(0, 6).map(({ id, who, service, sales, at }) => ({ id, who, service, sales, when: whenLabel(at) }));

  const delta = range === "today"
    ? (includeSeed ? salesSummary.salesDeltaLabel : todaySales > 0 ? "From this shop" : "No sales yet")
    : previousSales > 0
      ? `${rangeSales >= previousSales ? "+" : "−"}${Math.round((Math.abs(rangeSales - previousSales) / previousSales) * 100)}% vs previous ${span} days`
      : "No earlier days on record";

  return {
    delta,
    sales: rangeSales,
    cuts: todayCuts,
    collected: Math.max(0, todaySales - unpaidCentavos),
    unpaid: unpaidCentavos,
    average: todayCuts > 0 ? Math.round(todaySales / todayCuts) : 0,
    series,
    seriesKind: range === "today" || !includeSeed ? "hour" : "day",
    services: rowsFrom(services),
    payments: rowsFrom(payments),
    channels: rowsFrom(channels),
    barbers: rowsFrom(byBarber),
    chairs: rowsFrom(byChair),
    customers: names.size,
    recent,
  };
}
