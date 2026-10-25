"use client";

import { peso } from "@/lib/format";

const longDay = (date: string) => new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

export interface DayAmount { date: string; amount: number; cuts: number }

/** The day-by-day sales block shared by the owner and a barber. Same dates, same layout. */
export function DaySales({ eyebrow, total, days, today, empty }: { eyebrow: string; total: number; days: DayAmount[]; today: string; empty: string }) {
  const cuts = days.reduce((s, d) => s + d.cuts, 0);
  return (
    <>
      <section aria-label={eyebrow} className="mt-4 rounded-banner bg-ink px-4 py-4 text-on-ink">
        <p className="text-[12.5px] font-semibold text-on-ink-muted">{eyebrow}</p>
        <b className="mt-0.5 block text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(total)}</b>
        <p className="mt-2 text-[12.5px] font-semibold text-on-ink-muted">{cuts} cut{cuts === 1 ? "" : "s"}</p>
      </section>
      {cuts === 0 ? (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">{empty}</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-card bg-surface shadow-card" aria-label="Each day">
          {days.filter((x) => x.cuts > 0).map((x) => (
            <li key={x.date} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <b className="text-[14.5px]">{x.date === today ? `Today, ${longDay(x.date).split(", ").slice(1).join(", ")}` : longDay(x.date)}</b>
                <b className="text-[15px] tabular-nums">{peso(x.amount)}</b>
              </div>
              <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{x.cuts} cut{x.cuts === 1 ? "" : "s"}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
