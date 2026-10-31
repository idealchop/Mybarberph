/**
 * v1.0.32 barber week view (owner Weekly Profit Report → tap a barber row). Pure view-model over the SAME
 * ProfitRow the grid renders (profitWeek): day amounts and total are copied, never recomputed.
 * Claim colours come from the same claimStates map the grid cells use.
 */
import type { ProfitDay, ProfitRow } from "@/lib/profit-report";
import { cellClaimState } from "@/lib/profit-claim";

export type ClaimCell = { open: number; claimed: number; openOwner: number };
export interface BarberWeekDay { key: string; dow: string; date: string; amount: number; state: "open" | "claimed" | null; today: boolean; future: boolean }
export interface BarberWeekView { days: BarberWeekDay[]; total: number; toClaim: number; claimed: number }

export function barberWeekView(row: ProfitRow, days: ProfitDay[], claimMap: Map<string, ClaimCell> | null, today: string): BarberWeekView {
  let toClaim = 0, claimed = 0;
  const out = days.map((d, i) => {
    const amount = row.days[i] ?? 0;
    const cell = claimMap?.get(`${row.id}@${row.locationId}|${d.key}`);
    const state = amount ? cellClaimState(cell) : null;
    if (cell && amount) {
      const open = Math.min(amount, cell.openOwner);
      toClaim += open;
      if (cell.claimed > 0) claimed += amount - open;
    }
    return { key: d.key, dow: d.dow, date: d.date.slice(0, 5), amount, state, today: d.key === today, future: d.key > today };
  });
  return { days: out, total: row.total, toClaim, claimed };
}
