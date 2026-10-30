import type { ChairRequest } from "@/lib/booking-types";
import { isFinishedCut, manilaYmd } from "@/lib/cut-count";
import { splitIncome, tipOf, visitPct } from "@/lib/income-split";

/** A visit safe to render: string fields always strings (raw Firestore docs can miss them). */
export function historyRow(docId: string, b: Partial<ChairRequest>): ChairRequest {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return { ...b, id: s(b.id) || docId, ref: s(b.ref), serviceName: s(b.serviceName) || "Haircut", customerLabel: s(b.customerLabel), contact: s(b.contact),
    price: Number(b.price) || 0, createdAt: Number(b.createdAt) || 0, updatedAt: Number(b.updatedAt) || 0 } as ChairRequest;
}

/** One Manila day of a barber's finished cuts (barber link History, v1.0.19). Same rule as Sales: done + completedAt. */
export type HistoryDay = { date: string; rows: ChairRequest[]; cuts: number; sales: number; tips: number; earnings: number };

const DAY = 86_400_000;
export const ymdStart = (ymd: string) => Date.parse(`${ymd}T00:00:00+08:00`);
export const addDays = (ymd: string, n: number) => manilaYmd(ymdStart(ymd) + n * DAY);

/** What the barber takes home for these sales: their share (when the shop set one, else the full sales) plus tips. */
export function earningsOf(sales: number, tips: number, pct: number | null) {
  return (pct == null ? sales : splitIncome(sales, pct).barber) + tips;
}

export function dayOf(date: string, rows: ChairRequest[], pct: number | null): HistoryDay {
  const list = rows.filter((r) => isFinishedCut(r) && manilaYmd(r.completedAt!) === date).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const sales = list.reduce((s, r) => s + (r.price || 0), 0);
  const tips = list.reduce((s, r) => s + tipOf(r), 0);
  // Per visit (its own stamped %), then summed: the same centavos as the owner's side.
  const earnings = list.reduce((s, r) => s + earningsOf(r.price || 0, tipOf(r), visitPct(r, pct)), 0);
  return { date, rows: list, cuts: list.length, sales, tips, earnings };
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
