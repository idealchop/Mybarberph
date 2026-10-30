import { dayKey } from "@/lib/sales-stats";

/** Today's Manila day key (YYYY-MM-DD). */
export const todayKey = (now = Date.now()) => dayKey(now);

/** Finished visits whose completion falls on the given Manila day, newest first. */
export function doneOnDay<T extends { status: string; completedAt?: number; updatedAt: number }>(rows: T[], key: string): T[] {
  // v1.0.26: the shared finished-cut rule (cut-count.ts isFinishedCut): done WITH a completion time, on its Manila day.
  // It used to fall back to updatedAt, so the Queue could count a visit Home and the barber link never counted.
  return rows.filter((r) => r.status === "done" && Boolean(r.completedAt) && dayKey(r.completedAt!) === key).sort((a, b) => b.completedAt! - a.completedAt!);
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

/** Current visits (waiting or in the chair) opened on the given Manila day, oldest first (v1.0.25 Queue cards). */
export function activeOnDay<T extends { status: string; createdAt: number }>(rows: T[], key: string): T[] {
  return rows.filter((r) => (r.status === "requested" || r.status === "accepted" || r.status === "in_chair") && dayKey(r.createdAt) === key).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Every Home + Queue count for one Manila day, from rows ALREADY scoped to the selected location (v1.0.26).
 * Home hero haircuts, Today's barbers done, Customers and Queue Completed = `done`; Queue Current = `current`;
 * Today's barbers "waiting" = `waiting` (not yet in the chair).
 */
export function dayBoard<T extends { status: string; createdAt: number; completedAt?: number; updatedAt: number }>(rows: T[], key: string) {
  const done = doneOnDay(rows, key);
  const current = activeOnDay(rows, key);
  const inChair = current.filter((r) => r.status === "in_chair").length;
  return { done: done.length, current: current.length, inChair, waiting: current.length - inChair };
}
