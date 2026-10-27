import type { ChairRequest } from "@/lib/booking-types";
import { isFinishedCut, manilaYmd } from "@/lib/cut-count";
import { splitIncome, tipOf } from "@/lib/income-split";

/** One Manila day of a barber's finished cuts (barber link History, v1.0.19). Same rule as Sales: done + completedAt. */
export type HistoryDay = { date: string; rows: ChairRequest[]; cuts: number; sales: number; tips: number; earnings: number };

const DAY = 86_400_000;
export const ymdStart = (ymd: string) => Date.parse(`${ymd}T00:00:00+08:00`);
export const addDays = (ymd: string, n: number) => manilaYmd(ymdStart(ymd) + n * DAY);

/** What the barber takes home for these sales: their share (when the shop set one, else the full sales) plus tips. */
export function earningsOf(sales: number, tips: number, pct: number | null) {
  return (pct == null ? sales : splitIncome(sales, pct).barber) + tips;
}

/** Finished cuts grouped by Manila day, newest day first, rows newest first. */
export function groupByDay(rows: ChairRequest[], pct: number | null): HistoryDay[] {
  const m = new Map<string, ChairRequest[]>();
  for (const r of rows) {
    if (!isFinishedCut(r)) continue;
    const d = manilaYmd(r.completedAt!);
    m.set(d, [...(m.get(d) ?? []), r]);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, list]) => dayOf(date, list, pct));
}

export function dayOf(date: string, rows: ChairRequest[], pct: number | null): HistoryDay {
  const list = rows.filter((r) => isFinishedCut(r) && manilaYmd(r.completedAt!) === date).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const sales = list.reduce((s, r) => s + (r.price || 0), 0);
  const tips = list.reduce((s, r) => s + tipOf(r), 0);
  return { date, rows: list, cuts: list.length, sales, tips, earnings: earningsOf(sales, tips, pct) };
}

/** "Today, Oct 27" / "Yesterday, Oct 26" / "Mon, Oct 19". */
export function dayLabel(ymd: string, now = Date.now()) {
  const today = manilaYmd(now);
  const md = new Date(ymdStart(ymd)).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
  if (ymd === today) return `Today, ${md}`;
  if (ymd === addDays(today, -1)) return `Yesterday, ${md}`;
  const wd = new Date(ymdStart(ymd)).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short" });
  return `${wd}, ${md}`;
}
