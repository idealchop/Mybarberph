/** Per-barber sales for salary and remittance. Manila time (UTC+8, no DST); weeks run Monday to Sunday. */
export interface BarberSalesRow { barberId: string; barberName: string; locationId?: string; locationName?: string; cuts: number; gross: number; cash: number; gcash: number; online: number; unpaid: number; remit: number }
export interface BarberSales { range: "today" | "week" | "month" | "custom"; from: number; to: number; label: string; barbers: BarberSalesRow[]; total: BarberSalesRow }

const DAY = 86_400_000;
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T00:00:00+08:00`);
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** The Manila calendar day (YYYY-MM-DD) a moment falls on; days reset at midnight PHT. */
export const manilaYmd = ymd;
/** Start of the Manila day for YYYY-MM-DD. */
export const manilaDayStart = at;

/**
 * Inclusive Manila days for a sales filter. Owner Collection and a barber's My sales both use this,
 * so Today / 7 days / 30 days / this month / a custom range cover the same cuts.
 * `to` is exclusive (start of the day after the last day).
 */
export function periodBounds(range: string, now = Date.now(), custom?: { from: string; to: string } | null) {
  const today = at(ymd(now));
  const end = today + DAY;
  if (range === "today") return { from: today, to: end };
  if (range === "week") return { from: today - 6 * DAY, to: end };
  if (range === "d30") return { from: today - 29 * DAY, to: end };
  if (range === "month") return { from: at(`${ymd(now).slice(0, 7)}-01`), to: end };
  if (range === "custom" && custom?.from && /^\d{4}-\d{2}-\d{2}$/.test(custom.from)) {
    const f = at(custom.from);
    const raw = custom.to && /^\d{4}-\d{2}-\d{2}$/.test(custom.to) ? at(custom.to) + DAY : end;
    const to = Math.max(f + DAY, Math.min(raw, f + 62 * DAY));
    return { from: Math.min(f, to - DAY), to };
  }
  return { from: today - 27 * DAY, to: end };
}

/** Every Manila day in a period, newest first (YYYY-MM-DD). */
export function periodDays(range: string, now = Date.now(), custom?: { from: string; to: string } | null) {
  const { from, to } = periodBounds(range, now, custom);
  const days: string[] = [];
  for (let t = to - DAY; t >= from; t -= DAY) days.push(ymd(t));
  return days;
}

export function barberRange(range?: string | null, from?: string | null, to?: string | null, now = Date.now()) {
  const today = at(ymd(now));
  if (range === "today") return { range: "today" as const, from: today, to: today + DAY, label: `Today, ${fmt(today)}` };
  if (range === "custom" && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const f = at(from);
    const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? at(to) + DAY : today + DAY;
    const end = Math.max(f + DAY, Math.min(t, f + 366 * DAY));
    return { range: "custom" as const, from: f, to: end, label: `${fmt(f)} – ${fmt(end - DAY)}` };
  }
  if (range === "month") {
    const f = at(`${ymd(now).slice(0, 7)}-01`);
    return { range: "month" as const, from: f, to: today + DAY, label: new Date(f).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", year: "numeric" }) };
  }
  const dow = (new Date(today + 8 * 3600_000).getUTCDay() + 6) % 7; // Monday = 0
  const f = today - dow * DAY;
  return { range: "week" as const, from: f, to: f + 7 * DAY, label: `${fmt(f)} – ${fmt(f + 6 * DAY)}` };
}

export interface BarberPerformance {
  label: string; from: number; to: number;
  /** Collected by stored method. A paid visit with no method counts as cash (server rule); `other` is always 0. */
  cuts: number; sales: number; cash: number; gcash: number; online: number; other: number; unpaid: number; remit: number;
  avg: number; completionPct: number | null; declined: number;
  walkIns: number; onlineBookings: number;
  claimedCash: number; unclaimedCash: number;
  hours: { hour: number; cuts: number }[]; days: { day: string; cuts: number; sales: number }[];
  services: { name: string; cuts: number; sales: number }[];
  claims: { id: string; amount: number; ownerShare?: number; count: number; claimedAt: number }[];
  /** Barber share + tips per Manila hour (v1.0.22). */
  hourEarnings?: { hour: number; earnings: number }[];
  /** Income split (owner sets the barber's %). Tips are separate and 100% the barber's. */
  /** Owner's share of the unclaimed cash: what the barber hands over. */ unclaimedOwner?: number;
  /** null = no split set. */ sharePct?: number | null; barberShare?: number; shopShare?: number; tips?: number; tipCount?: number;
  /** Speed: average and fastest minutes from start to done, over cuts with a timer. */
  avgMins?: number | null; fastestMins?: number | null; timedCuts?: number;
  /** Per Manila day, newest first (days with finished cuts only). earnings = your share (or sales when no split) + tips. */
  byDate?: { date: string; cuts: number; sales: number; tips: number; earnings: number; cashOpen?: number; cashClaimed?: number }[];
}

export type HistoryPreset = "7" | "30" | "month" | "lastMonth" | "custom";
/** From/to (Manila YYYY-MM-DD, inclusive) for a History preset. */
export function historyRange(p: HistoryPreset, now = Date.now(), custom?: { from: string; to: string }) {
  const today = ymd(now);
  const back = (n: number) => ymd(Date.parse(`${today}T00:00:00+08:00`) - n * 86_400_000);
  if (p === "7") return { from: back(6), to: today };
  if (p === "30") return { from: back(29), to: today };
  if (p === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (p === "lastMonth") {
    const first = Date.parse(`${today.slice(0, 7)}-01T00:00:00+08:00`);
    const lastPrev = ymd(first - 86_400_000);
    return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
  }
  return custom ?? { from: back(6), to: today };
}


/** The barber's own read-only profile on their link (v1.0.22). Own share + tips only; rank is a position. */
export interface BarberProfile {
  range: "today" | "7d" | "all"; from: string; to: string; label: string;
  sharePct: number | null; rank: number | null; of: number;
  cuts: number; earnings: number; share: number; tips: number; avgTicket: number; perHour: number | null;
  peakHour: { hour: number; earnings: number; cuts: number } | null;
  toClaim: number; claimed: number;
  byDate: { date: string; cuts: number; earnings: number; tips: number }[];
  byHour: { hour: number; earnings: number; cuts: number }[];
  /** The barber's own visits (last 366 days); price = their share of the visit, tip separate. */
  rows: BarberProfileRow[];
}
export interface BarberProfileRow {
  id: string; status: string; price: number; tip: number; completedAt?: number; createdAt: number; updatedAt?: number; startedAt?: number;
  channel?: string; locationId: string; barberId: string; serviceName?: string; rating?: number; feedback?: string; customerLabel?: string; home?: boolean; paid?: boolean; payMethod?: string;
}
