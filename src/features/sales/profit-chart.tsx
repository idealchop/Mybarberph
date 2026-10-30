"use client";

import { peso } from "@/lib/format";
import { rankProfitRows, type ProfitRow } from "@/lib/profit-report";
import { cn } from "@river-apps/ui";

const ROW = "grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-2.5 lg:grid-cols-[12rem_1fr_7.5rem] lg:gap-4";

/**
 * Owner-only (v1.0.29): a bar chart of each barber's weekly total, under the Weekly Profit Report table.
 * Uses the table's rows as-is (same week, location, owner split, GCash), so the bars always match the Total column.
 * Highest bar is solid black, lowest (among barbers with sales) is marked red; barbers with no haircuts sit muted at the bottom.
 */
export function ProfitChart({ rows, showBranch, label }: { rows: ProfitRow[]; showBranch: boolean; label?: string }) {
  const { ranked, zero, top, lowest, max } = rankProfitRows(rows);
  if (!rows.length) return null;
  return (
    <section aria-label="Weekly totals chart" className="mt-5 rounded-card bg-surface p-4 shadow-card lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-extrabold tracking-[-0.02em]">Barber totals</h2>
        {label ? <span className="text-[12px] font-semibold text-muted tabular-nums">{label}</span> : null}
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-3 text-[11.5px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1"><i aria-hidden className="h-2 w-3 rounded-pill bg-ink" />Highest</span>
        <span className="inline-flex items-center gap-1"><i aria-hidden className="h-2 w-3 rounded-pill bg-[#C62828]/75" />Lowest</span>
      </p>
      <ul className="mt-3.5 space-y-2.5">
        {ranked.map((r) => {
          const hi = r === top, lo = r === lowest;
          return (
            <li key={`${r.id}@${r.locationId}`} className={cn(ROW, "text-[12.5px] lg:text-[13px]")}
              aria-label={`${r.name}${showBranch && r.locationName ? `, ${r.locationName}` : ""}: ${peso(r.total)}${hi ? ", highest" : lo ? ", lowest" : ""}`}>
              <span className="min-w-0">
                <span className={cn("block truncate", hi ? "font-extrabold" : "font-semibold")}>{r.name}</span>
                {showBranch && r.locationName ? <span className="block truncate text-[10.5px] font-medium text-muted">{r.locationName}</span> : null}
              </span>
              <span className="h-4 overflow-hidden rounded-pill bg-grey-100 lg:h-5">
                <span className={cn("block h-full rounded-pill", hi ? "bg-ink" : lo ? "bg-[#C62828]/75" : "bg-[#9A9A9A]")} style={{ width: `${Math.max(3, (r.total / max) * 100)}%` }} />
              </span>
              <b className={cn("text-right tabular-nums", lo && "text-[#C62828]")}>{peso(r.total)}</b>
            </li>
          );
        })}
        {zero.map((r) => (
          <li key={`${r.id}@${r.locationId}`} className={cn(ROW, "text-[12.5px] text-muted opacity-70 lg:text-[13px]")}>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{r.name}</span>
              {showBranch && r.locationName ? <span className="block truncate text-[10.5px] font-medium">{r.locationName}</span> : null}
            </span>
            <span className="h-4 rounded-pill bg-grey-100 lg:h-5" />
            <span className="text-right text-[11px] font-semibold">No haircuts</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
