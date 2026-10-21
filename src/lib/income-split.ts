/** Income split (Jimboy, 2026-10-21): the owner sets each barber's share of sales. Tips are 100% the barber's. */
/**
 * A chair's barber share, 0–100, or null = None (no split; the default since 2026-10-21).
 * Only an owner-chosen split counts: `shareSet: true`, or an older saved value other than 50
 * (50 was the old default the editor saved for everyone, so a bare 50 reads as None).
 */
export function sharePct(chair?: { sharePct?: unknown; shareSet?: unknown } | null): number | null {
  if (chair?.sharePct === null || chair?.sharePct === undefined || chair.sharePct === "") return null;
  const n = Number(chair.sharePct);
  if (!(Number.isFinite(n) && n >= 0 && n <= 100)) return null;
  return chair.shareSet === true || Math.round(n) !== 50 ? Math.round(n) : null;
}

/** "60% share" / "No split" for lists. */
export const shareLabel = (pct: number | null) => (pct == null ? "No split" : `${pct}% share`);

/** Splits sales (centavos) into the barber's and the shop's part. The shop gets the rounding remainder. */
/** None (null) = no split: nothing is taken off for the barber. */
export function splitIncome(sales: number, pct: number | null) {
  const barber = pct == null ? 0 : Math.round((Math.max(0, sales) * Math.min(100, Math.max(0, pct))) / 100);
  return { barber, shop: Math.max(0, sales) - barber };
}

/** Tip on a visit in centavos (0 when none or bad). */
export function tipOf(row: { tip?: unknown }): number {
  const n = Math.round(Number(row.tip));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** One-tap tip amounts on the Complete sheet (pesos). */
export const TIP_CHIPS = [20, 50, 100] as const;

/** The customer's name to show, or "" for the default "Walk-in" label (no need to say it on every card). */
export function customerName(row: { customerLabel?: string; contact?: string }): string {
  const n = row.customerLabel?.trim() ?? "";
  return n && n.toLowerCase() !== "walk-in" ? n : "";
}

/** Minutes from start to done, or null when the visit has no usable start/finish. */
export function cutMinutes(row: { startedAt?: number; completedAt?: number }): number | null {
  if (!row.startedAt || !row.completedAt || row.completedAt <= row.startedAt) return null;
  const m = (row.completedAt - row.startedAt) / 60_000;
  // Ignore obviously forgotten timers (over 4 hours).
  return m > 240 ? null : m;
}
