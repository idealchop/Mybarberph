/**
 * v1.0.32 barber week view (owner Weekly Profit Report → tap a barber row). Pure view-model over the SAME
 * ProfitRow the grid renders (profitWeek): day amounts and total are copied, never recomputed.
 * Claim colours come from the same claimStates map the grid cells use.
 */
import type { ProfitDay, ProfitRow } from "@/lib/profit-report";
import type { CellDelta } from "@/lib/claim-adjusts";

export type ClaimCell = { open: number; claimed: number; openOwner: number };
export type DayState = "open" | "claimed" | "mixed" | null;
export interface BarberWeekDay { key: string; dow: string; date: string; amount: number; toClaim: number; claimed: number; state: DayState; today: boolean; future: boolean }
export interface BarberWeekView { days: BarberWeekDay[]; total: number; toClaim: number; claimed: number }

/**
 * v1.0.41: split one grid cell (owner share shown, edits included) into its To claim and claimed parts.
 * To claim = the open haircuts' share + the saved To claim edit; claimed = the rest of the cell (claimed haircuts,
 * adjusted claims). A day that was partly claimed earlier is "mixed", never shown as all To claim.
 */
export function cellSplit(amount: number, cell: ClaimCell | undefined, adj?: CellDelta): { toClaim: number; claimed: number; state: DayState } {
  if (!cell || !amount) return { toClaim: 0, claimed: 0, state: null };
  const toClaim = cell.open > 0 ? Math.max(0, Math.min(amount, cell.openOwner + (adj?.open ?? 0))) : 0;
  const claimed = cell.claimed > 0 ? amount - toClaim : 0;
  const state: DayState = toClaim > 0 && claimed > 0 ? "mixed" : toClaim > 0 ? "open" : cell.claimed > 0 ? "claimed" : cell.open > 0 ? "open" : null;
  return { toClaim, claimed, state };
}

export function barberWeekView(row: ProfitRow, days: ProfitDay[], claimMap: Map<string, ClaimCell> | null, today: string, cells?: Map<string, CellDelta>): BarberWeekView {
  let toClaim = 0, claimed = 0;
  const out = days.map((d, i) => {
    const amount = row.days[i] ?? 0;
    const key = `${row.id}@${row.locationId}|${d.key}`;
    const s = cellSplit(amount, claimMap?.get(key), cells?.get(key));
    toClaim += s.toClaim; claimed += s.claimed;
    return { key: d.key, dow: d.dow, date: d.date.slice(0, 5), amount, toClaim: s.toClaim, claimed: s.claimed, state: s.state, today: d.key === today, future: d.key > today };
  });
  return { days: out, total: row.total, toClaim, claimed };
}
