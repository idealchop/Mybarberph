import { dayKey } from "@/lib/sales-stats";

/** Today's Manila day key (YYYY-MM-DD). */
export const todayKey = (now = Date.now()) => dayKey(now);

/** Finished visits whose completion falls on the given Manila day, newest first. */
export function doneOnDay<T extends { status: string; completedAt?: number; updatedAt: number }>(rows: T[], key: string): T[] {
  const at = (r: T) => r.completedAt ?? r.updatedAt;
  return rows.filter((r) => r.status === "done" && dayKey(at(r)) === key).sort((a, b) => at(b) - at(a));
}

/** Header label for a Manila day: "Today" or "Oct 21". */
export function queueDayLabel(key: string, now = Date.now()): string {
  if (key === todayKey(now)) return "Today";
  return new Date(`${key}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
}

/** Month grid for the picker: leading nulls for the weekday offset, then day keys. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)];
}
