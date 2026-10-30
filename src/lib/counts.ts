/**
 * THE counting rules (v1.0.24 guardrail). Every haircut / sales / split total, owner or barber, must be explainable by
 * these functions; the invariant tests (tests/unit/count-invariants.test.ts) and the reconcile script
 * (scripts/reconcile-counts.ts) use them directly, and screens use the same primitives they wrap.
 *
 * Rules
 * - A haircut counts when it is finished (status "done" with completedAt) on the Manila day of completedAt.
 * - It belongs to its barberId at its location (never a chair label or a name); no barberId = Unassigned;
 *   "owner" = the owner's own haircut (owner totals only, no barber link).
 * - Split per visit: barber share = round(price × pct / 100) with the % stamped on the visit (else the barber's
 *   current %); owner share = price − barber share; no split set = owner keeps the full price on owner screens and
 *   the barber sees the full price on barber screens. Tips are 100% the barber's and never part of a share.
 * - Totals come from a WHOLE-DAY server read (sales-rows / barberDayCuts), never from a capped live list.
 */
import { cutBarberId, isFinishedCut, manilaYmd, UNASSIGNED } from "@/lib/cut-count";
import { sharePct, splitIncome, tipOf, visitPct } from "@/lib/income-split";

type Chair = { id: string; barberId?: string; locationId?: string; sharePct?: unknown; shareSet?: unknown };
type Visit = { id: string; status?: string; completedAt?: number; price?: number; tip?: number; barberId?: string; barberName?: string; locationId?: string; splitPct?: number | null };

export interface Totals { haircuts: number; sales: number; owner: number; barber: number; tips: number }
const zero = (): Totals => ({ haircuts: 0, sales: 0, owner: 0, barber: 0, tips: 0 });

/** The chair (barber link) a barberId@location belongs to; same lookup as the remit and the day sheet. */
export function chairFor(chairs: Chair[], barberId: string, loc: string) {
  return chairs.find((c) => (c.barberId || c.id) === barberId && (c.locationId || "home") === loc) ?? chairs.find((c) => (c.barberId || c.id) === barberId);
}

/** One visit's split. `barberSeen` is what the barber's screens show (full price when no split is set). */
export function visitSplit(r: Visit, chairs: Chair[]) {
  const id = cutBarberId(r, chairs as never), loc = r.locationId || "home";
  const price = Math.max(0, r.price || 0);
  const pct = id === "owner" || id === UNASSIGNED ? null : visitPct(r, sharePct(chairFor(chairs, id, loc)));
  const barber = pct == null ? 0 : splitIncome(price, pct).barber;
  return { barberId: id, loc, price, pct, barber, owner: price - barber, barberSeen: pct == null ? price : barber, tip: tipOf(r as never) };
}

/** Per barberId@location totals for one Manila day. */
export function dayTotals(rows: Visit[], chairs: Chair[], day: string): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const r of rows) {
    if (!isFinishedCut(r as never) || manilaYmd(r.completedAt!) !== day) continue;
    const s = visitSplit(r, chairs); const k = `${s.barberId}@${s.loc}`;
    const t = out.get(k) ?? zero();
    t.haircuts++; t.sales += s.price; t.owner += s.owner; t.barber += s.barber; t.tips += s.tip;
    out.set(k, t);
  }
  return out;
}

/** Owner total for a day (optionally one location): every finished haircut, every barber, the owner's own included. */
export function ownerDayTotal(rows: Visit[], chairs: Chair[], day: string, loc = "all"): Totals {
  const t = zero();
  for (const [k, v] of dayTotals(rows, chairs, day)) {
    if (loc !== "all" && k.slice(k.indexOf("@") + 1) !== loc) continue;
    t.haircuts += v.haircuts; t.sales += v.sales; t.owner += v.owner; t.barber += v.barber; t.tips += v.tips;
  }
  return t;
}
