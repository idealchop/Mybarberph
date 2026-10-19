import type { ChairRequest } from "@/lib/chair-bookings";
import { dayKey, rangeKeys } from "@/lib/sales-stats";
import type { SalesRange } from "@/lib/sales-report";

/** When a visit finished (Manila day decides which list it belongs to). */
const doneAt = (r: ChairRequest) => r.completedAt ?? r.updatedAt;

/**
 * Finished visits whose completion falls on a Manila day inside the range, newest first.
 * "today" = Manila midnight → now, so yesterday's cuts never show under "Done today".
 */
export function doneInRange(rows: ChairRequest[], range: SalesRange): ChairRequest[] {
  const { keys } = rangeKeys(range);
  return rows.filter((r) => r.status === "done" && keys.has(dayKey(doneAt(r)))).sort((a, b) => doneAt(b) - doneAt(a));
}

const short = (key: string) => new Date(`${key}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Section label for the done list: "Done today", "Done · Oct 16", "Done · Oct 13 – Oct 19", "Done · all time". */
export function doneLabel(range: SalesRange): string {
  if (range === "all") return "Done · all time";
  if (range === "week") return "Done · last 7 days";
  const keys = [...rangeKeys(range).keys].sort();
  const first = keys[0], last = keys[keys.length - 1];
  if (!first || !last) return "Done";
  if (first === last) return first === dayKey(Date.now()) ? "Done today" : `Done · ${short(first)}`;
  return `Done · ${short(first)} – ${short(last)}`;
}
