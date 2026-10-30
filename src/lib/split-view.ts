/**
 * Split-only money (Jimboy, 2026-10-30): owner screens show the OWNER's part of each cut, barber screens the
 * BARBER's part, using the share set on each barber's profile. Full sales are never shown on report screens.
 * Collecting from the customer (queue, complete flow, receipts) still uses the full price.
 */
import { ownerShareOf, sharePct, splitIncome, tipOf, visitPct } from "@/lib/income-split";

export const OWNER_ID = "owner";
type Chair = { id: string; barberId?: string; locationId?: string; sharePct?: unknown; shareSet?: unknown };
type Row = { barberId?: string; locationId?: string; price: number; tip?: number; splitPct?: number | null };

/** The barber's split % for a visit (chair of that barber at that branch, else any of their chairs); null = no split. */
export function pctForRow(r: { barberId?: string; locationId?: string; splitPct?: number | null }, chairs: Chair[]): number | null {
  if (!r.barberId || r.barberId === OWNER_ID) return null;
  if ("splitPct" in r && r.splitPct !== undefined) return visitPct(r, null);
  const loc = r.locationId || "home";
  const mine = (c: Chair) => c.barberId === r.barberId || c.id === r.barberId;
  const c = chairs.find((x) => mine(x) && (x.locationId || "home") === loc) ?? chairs.find(mine);
  return c ? sharePct(c) : null;
}

/** Owner's part of one cut (centavos): full price for the owner's own cuts or when no split is set. Tips are the barber's. */
export const ownerPart = (r: Row, chairs: Chair[]) => (r.barberId === OWNER_ID ? Math.max(0, r.price || 0) : ownerShareOf(r.price || 0, pctForRow(r, chairs)));

/** Barber's part of one cut (centavos) plus their tip. No split set = the full price (as My sales always showed). */
export function barberPart(r: Row, chairs: Chair[]) {
  const pct = pctForRow(r, chairs);
  return (pct == null ? Math.max(0, r.price || 0) : splitIncome(r.price || 0, pct).barber) + tipOf(r);
}

/** Rows for OWNER report screens: price = owner's part, no tip. Same ids/status/dates, so counts don't change. */
export function asOwnerSplit<T extends Row>(rows: T[], chairs: Chair[]): T[] {
  return rows.map((r) => ({ ...r, price: ownerPart(r, chairs), tip: undefined }));
}

/** Rows for BARBER screens: price = barber's part INCLUDING the tip (tip folded in). Not used by screens since v1.0.22 (barber views show share only, tips separate). */
export function asBarberSplit<T extends Row>(rows: T[], chairs: Chair[]): T[] {
  return rows.map((r) => ({ ...r, price: barberPart(r, chairs), tip: undefined }));
}
