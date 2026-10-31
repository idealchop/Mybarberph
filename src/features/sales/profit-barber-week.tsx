"use client";

import { Button } from "@/components/common/button";
import { peso } from "@/lib/format";
import type { ProfitDay, ProfitRow } from "@/lib/profit-report";
import { barberWeekView, type ClaimCell } from "@/lib/profit-barber-week";
import { cn } from "@river-apps/ui";
import { ArrowLeft } from "lucide-react";

/** One barber's week from the owner grid (same row, same claim map), full screen. Day amounts open the day sheet. */
export function ProfitBarberWeek({ row, days, claimMap, today, range, onDay, onBack }: {
  row: ProfitRow; days: ProfitDay[]; claimMap: Map<string, ClaimCell> | null; today: string; range: string;
  onDay: (day: string) => void; onBack: () => void;
}) {
  const v = barberWeekView(row, days, claimMap, today);
  const parts = [v.toClaim > 0 ? <span key="o" className="text-[#FF8A8A]">{peso(v.toClaim)} to claim</span> : null,
    v.claimed > 0 ? <span key="c">{peso(v.claimed)} claimed</span> : null].filter(Boolean);
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-2 lg:max-w-[640px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-2.5">
        <Button icon variant="white" aria-label="Back to weekly report" onClick={onBack} className="flex-none shadow-card"><ArrowLeft size={20} strokeWidth={2.4} /></Button>
        <div className="min-w-0">
          <h1 className="truncate text-[21px] font-extrabold leading-tight tracking-[-0.03em]">{row.name}</h1>
          <p className="truncate text-[12.5px] font-semibold text-muted">{[row.locationName, range].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <section aria-label="Your share this week" className="mt-3.5 rounded-banner bg-ink p-4 text-on-ink">
        <p className="text-[12.5px] font-semibold text-on-ink-muted">Your share this week</p>
        <b data-testid="week-total" className="mb-2 mt-1 block text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(v.total)}</b>
        {parts.length ? <p className="text-[12.5px] font-semibold text-on-ink-muted">{parts.flatMap((p, i) => (i ? [" · ", p] : [p]))}</p> : null}
      </section>
      <ul className="mt-3.5 overflow-hidden rounded-card bg-surface shadow-card">
        {v.days.map((d) => (
          <li key={d.key} className={cn("flex min-h-14 items-center justify-between border-b border-line px-4 py-2 last:border-0", d.today && "bg-grey-100")}>
            <div>
              <b className="block text-[15px] font-bold">{d.dow}</b>
              <span className={cn("text-[12px] font-semibold", d.today ? "font-bold text-ink" : "text-muted")}>{d.date}{d.today ? " · Today" : ""}</span>
            </div>
            {d.future ? <span className="text-[17px] font-extrabold text-muted opacity-40">–</span> : (
              <button type="button" onClick={() => onDay(d.key)} aria-label={`${d.dow} ${d.date}: ${d.amount ? peso(d.amount) : "no sales"}${d.state === "open" ? ", unclaimed" : d.state === "claimed" ? ", claimed" : ""}. Claim, records and add`}
                className="-mr-2 flex min-h-11 items-center rounded-lg px-2 active:bg-grey-200">
                {d.amount ? (
                  <span className={cn("border-b-[1.5px] border-dotted text-[17px] font-extrabold tabular-nums", d.state === "open" ? "border-[#C62828]/60 text-[#C62828]" : d.state === "claimed" ? "border-[#0B7A3E]/60 text-[#0B7A3E]" : "border-muted/70")}>{peso(d.amount)}</span>
                ) : <span className="text-[17px] font-extrabold text-muted">–</span>}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mx-1 my-3.5 flex items-center gap-4 text-[12px] font-bold">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden className="size-2 rounded-full bg-[#C62828]" />To claim</span>
        <span className="inline-flex items-center gap-1.5"><i aria-hidden className="size-2 rounded-full bg-[#0B7A3E]" />Claimed</span>
      </p>
      <Button variant="primary" className="w-full" onClick={onBack}>Back to weekly report</Button>
    </div>
  );
}
