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

/** Shop/barber parts of several amounts, each with its barber's split % (null = no split; counted apart). Tips are never included. */
export function splitTotals(items: { amount: number; pct: number | null }[]) {
  const t = { total: 0, shop: 0, barber: 0, none: 0 };
  for (const i of items) {
    t.total += i.amount;
    if (i.pct == null) { t.none += i.amount; continue; }
    const s = splitIncome(i.amount, i.pct); t.shop += s.shop; t.barber += s.barber;
  }
  return t;
}

/** "Shop ₱1,375 · Barber ₱1,375" (+ "· No split ₱X" when mixed); null when no amount has a split. */
export function splitLine(t: { shop: number; barber: number; none: number }, peso: (c: number) => string): string | null {
  if (!t.shop && !t.barber) return null;
  return [`Shop ${peso(t.shop)}`, `Barber ${peso(t.barber)}`, t.none ? `No split ${peso(t.none)}` : ""].filter(Boolean).join(" · ");
}

/** The shop/owner's part of one cut: price minus the barber's share. No split (None) = the full amount is the owner's. */
export const ownerShareOf = (price: number, pct: number | null) => (pct == null ? Math.max(0, price) : splitIncome(price, pct).shop);

/** Owner share of a claim; old claims (before ownerShare was stored) are computed from the barber's current split. */
export function claimOwnerShare(c: { amount: number; ownerShare?: number }, pct: number | null) {
  return typeof c.ownerShare === "number" ? c.ownerShare : ownerShareOf(c.amount, pct);
}
