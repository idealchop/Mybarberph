"use client";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { peso } from "@/lib/format";
import { compactPeso, dayBreakdown, groupProfitRows, type ProfitMonth, type ProfitRow } from "@/lib/profit-report";
import { cn } from "@river-apps/ui";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const longDay = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" });

/** Month calendar (Jimboy, 2026-10-27): every day's owner profit after commission; tap a day for its breakdown. */
export function ProfitMonthCalendar({ m, today, onPick }: { m: ProfitMonth; today: string; onPick: (date: string) => void }) {
  const cells: (string | null)[] = [...Array(m.lead).fill(null), ...m.dates];
  while (cells.length % 7) cells.push(null);
  return (
    <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
      <div className="grid grid-cols-7 bg-ink text-center text-[10.5px] font-bold text-on-ink">
        {DOW.map((d) => <span key={d} className="py-2">{d}</span>)}
      </div>
      <div role="grid" aria-label={`${m.label} by day`} className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="min-h-[54px] border-b border-r border-line bg-grey-50 [&:nth-child(7n)]:border-r-0" />;
          const k = m.dates.indexOf(d), n = m.dayTotals[k] ?? 0, future = d > today, isToday = d === today;
          return (
            <button key={d} type="button" disabled={future} onClick={() => onPick(d)} aria-label={`${longDay(d)}: ${future ? "upcoming" : n ? peso(n) : "no sales"}`}
              className={cn("flex min-h-[54px] flex-col items-center justify-center gap-0.5 border-b border-r border-line px-0.5 [&:nth-child(7n)]:border-r-0 active:bg-grey-200 disabled:active:bg-transparent", isToday && "bg-ink text-on-ink active:bg-ink")}>
              <span className={cn("text-[11px] font-semibold leading-none", isToday ? "text-on-ink-muted" : "text-muted")}>{Number(d.slice(8))}</span>
              <span className={cn("text-[12.5px] font-extrabold leading-none tabular-nums", future && "font-semibold opacity-40", !n && !future && !isToday && "font-semibold text-muted")}>{future || !n ? "–" : compactPeso(n)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Group = { id: string; name: string; locationIds: string[]; barberIds: string[] };

/** One day of the month: each barber's amount (or per Sales group with subtotals); tap a barber for the day sheet. */
export function ProfitDayBreakdown({ m, date, groups, showBranch, onBarber, onClose }: {
  m: ProfitMonth; date: string; groups: Group[] | null; showBranch: boolean; onBarber: (row: ProfitRow) => void; onClose: () => void;
}) {
  const rows = dayBreakdown(m, date);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const sections = groups ? groupProfitRows(rows, groups) : [{ id: "all", name: "", rows, total }];
  const row = (r: ProfitRow) => (
    <li key={`${r.id}@${r.locationId}`} className="border-b border-line last:border-b-0">
      <button type="button" onClick={() => onBarber(r)} className="flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-grey-200">
        <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{r.name}</b>{(showBranch || r.sameName) && r.locationName ? <small className="block truncate text-[12px] font-semibold text-muted">{r.locationName}</small> : null}</span>
        <b className="flex-none text-[15px] tabular-nums">{peso(r.total)}</b>
        <ChevronRight size={16} className="flex-none text-muted" aria-hidden />
      </button>
    </li>
  );
  return (
    <BottomSheet title={longDay(date)} subtitle="Your profit after commission" onClose={onClose} tall={rows.length > 6}>
      <div className="flex flex-col gap-4 pb-2 pt-1">
        <section className="rounded-[22px] bg-ink px-4 py-3.5 text-on-ink">
          <p className="text-[12.5px] font-semibold text-on-ink-muted">Day total</p>
          <b className="mt-0.5 block text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(total)}</b>
          <p className="mt-1.5 text-[12.5px] font-semibold text-on-ink-muted">{rows.length} barber{rows.length === 1 ? "" : "s"} with sales</p>
        </section>
        {rows.length === 0 ? <p className="rounded-[18px] bg-grey-100 px-4 py-5 text-center text-[13.5px] font-semibold text-muted">No finished haircuts this day.</p> : sections.map((g) => (
          <Fragment key={g.id}>
            <div>
              {g.name ? (
                <div className="flex items-baseline justify-between px-1 pb-1.5">
                  <b className="text-[14.5px]">{g.name}</b>
                  <span className="text-[13px] font-bold tabular-nums text-muted">Subtotal {peso(g.total)}</span>
                </div>
              ) : null}
              <ul className="overflow-hidden rounded-[20px] bg-grey-100">{g.rows.map(row)}</ul>
            </div>
          </Fragment>
        ))}
      </div>
    </BottomSheet>
  );
}
