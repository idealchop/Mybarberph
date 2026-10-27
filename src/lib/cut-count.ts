import type { ChairRequest } from "@/lib/booking-types";
/** Same value as HOME_LOCATION_ID in shop-locations (kept here so server code can import this file). */
const HOME_LOCATION_ID = "home";

/**
 * ONE rule for "whose cut is this" and "is it a finished cut on day X".
 * Used by the barber link, My sales, Home, Sales, Profit report, remittance and Companion
 * so barber and owner views always agree (Jimboy, 2026-10-26). No chair/seat fallback.
 */
export type CutChair = { id: string; label?: string; locationId?: string; barberId?: string };
type CutRow = Pick<ChairRequest, "barberId" | "barberName">;

export const cutLocation = (r: { locationId?: string }) => r.locationId || HOME_LOCATION_ID;

/** Key for cuts with no barber on them. Shown as "Unassigned" on every screen so totals add up. */
export const UNASSIGNED = "unassigned";
export const UNASSIGNED_NAME = "Unassigned";

/**
 * Barber a visit counts toward (Jimboy 2026-10-27, no chairs/seats): its saved barberId, else its saved
 * barber name (as Companion v1.0.12 did), else Unassigned. Chairs are never looked up.
 */
export function cutBarberId(r: CutRow, _chairs?: CutChair[]): string {
  void _chairs;
  const name = r.barberName?.trim();
  return r.barberId || (name ? `name:${name.toLowerCase()}` : UNASSIGNED);
}

/** Display name for a cut's barber: the barber record's name, else the name saved on the visit, else Unassigned. */
export function cutBarberName(r: Pick<ChairRequest, "barberId" | "barberName">, chairs: (CutChair & { barberName?: string })[]): string {
  if (!r.barberId) return r.barberName?.trim() || UNASSIGNED_NAME;
  const c = chairs.find((x) => (x.barberId || x.id) === r.barberId) ?? chairs.find((x) => x.id === r.barberId);
  return c?.barberName?.trim() || r.barberName?.trim() || r.barberId;
}

/** Manila (UTC+8) calendar day of a timestamp. */
export const manilaYmd = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);

/** A finished cut, dated by when it finished. */
export const isFinishedCut = (r: Pick<ChairRequest, "status" | "completedAt">) => r.status === "done" && !!r.completedAt;

/** Is this row a finished cut of this barber (optionally at one branch, within [from, to) ms)? */
export function isBarbersCut(r: ChairRequest, barberId: string, chairs: CutChair[], opt: { locationId?: string; from?: number; to?: number } = {}) {
  if (!isFinishedCut(r)) return false;
  if (opt.locationId && cutLocation(r) !== opt.locationId) return false;
  const at = r.completedAt || 0;
  if (opt.from != null && at < opt.from) return false;
  if (opt.to != null && at >= opt.to) return false;
  return cutBarberId(r, chairs) === barberId;
}

/** Count finished cuts per barber key (`${barberId}@${location}`) within [from, to). */
export function countCuts(rows: ChairRequest[], chairs: CutChair[], from: number, to: number) {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!isFinishedCut(r) || (r.completedAt || 0) < from || (r.completedAt || 0) >= to) continue;
    const k = `${cutBarberId(r, chairs)}@${cutLocation(r)}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Deep (history) rows plus the live snapshot: live edits win, deletions in the live window drop, new live rows join. */
export function mergeLiveRows<T extends { id: string; createdAt: number }>(deep: T[] | null | undefined, live: T[]): T[] {
  if (!deep) return live;
  const byId = new Map(live.map((r) => [r.id, r]));
  const liveFrom = live.reduce((m, r) => Math.min(m, r.createdAt), Infinity);
  const kept = deep.filter((r) => byId.has(r.id) || r.createdAt < liveFrom).map((r) => byId.get(r.id) ?? r);
  const ids = new Set(kept.map((r) => r.id));
  return [...kept, ...live.filter((r) => !ids.has(r.id))];
}

/** Finished cuts in `rows` that finished on today's Manila date (the barber link's History label and Sales > Today). */
export function countToday(rows: Pick<ChairRequest, "status" | "completedAt">[], now = Date.now()): number {
  const today = manilaYmd(now);
  return rows.filter((r) => isFinishedCut(r) && manilaYmd(r.completedAt!) === today).length;
}
