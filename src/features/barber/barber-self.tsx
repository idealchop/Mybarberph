"use client";
import { ChevronLeft } from "lucide-react";
import { AppLoader } from "@/components/common/app-loader";
import { useEffect, useState } from "react";
import { periodBounds, periodDays, type BarberPerformance } from "@/lib/barber-sales";
import { DAY_RANGES, getCustomRange, type SalesRange } from "@/lib/sales-report";
import { DaySales } from "@/features/sales/day-sales";
import { RangeChips } from "@/features/sales/range-chips";
import { peso } from "@/lib/format";

const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

/** Loads the barber's numbers for a query; refreshes every 30s while visible. */
function usePerformance(token: string, qs: string) {
  const [data, setData] = useState<BarberPerformance | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const pull = () => void fetch(`/api/barber/${token}/performance?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn’t load your sales."))))
      .then((d: BarberPerformance) => { if (live) { setData(d); setErr(""); } })
      .catch((e: Error) => { if (live) setErr(e.message); });
    pull();
    // Refresh every 30s only while the tab is visible, and once when it comes back (river-ai-rules 03-build/performance).
    const t = window.setInterval(() => { if (document.visibilityState === "visible") pull(); }, 30_000);
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { live = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [token, qs]);
  return { data, err, setData };
}

/** My sales: the same day filters and daily list as the owner's Collection. */
export function BarberPerformanceView({ token, who, place, onBack, extra }: { token: string; who: string; place?: string; onBack: () => void; extra?: React.ReactNode }) {
  const [range, setRange] = useState<SalesRange>("today");
  const [dayKey, setDayKey] = useState(() => ymd(Date.now()));
  useEffect(() => { const t = window.setInterval(() => setDayKey(ymd(Date.now())), 60_000); return () => window.clearInterval(t); }, []);
  const custom = range === "custom" ? getCustomRange() : null;
  const days = periodDays(range, Date.now(), custom);
  const bounds = periodBounds(range, Date.now(), custom);
  const from = days[days.length - 1] ?? dayKey;
  const to = days[0] ?? dayKey;
  const { data, err } = usePerformance(token, `range=custom&from=${from}&to=${to}&d=${dayKey}`);
  if (!data && !err) return <AppLoader label="Loading your sales" />;
  const by = new Map((data?.byDate ?? []).map((x) => [x.date, x]));
  const rows = days.map((date) => ({ date, amount: by.get(date)?.earnings ?? 0, cuts: by.get(date)?.cuts ?? 0 }));
  const total = rows.reduce((s, x) => s + x.amount, 0);
  const loaded = data?.from === bounds.from;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">My sales</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{[who, place].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="mt-3"><RangeChips value={range} onChange={setRange} ranges={DAY_RANGES} allowCustom /></div>
      {extra}
      {err && !data ? <p className="mt-4 text-[13.5px] font-semibold">{err}</p> : null}
      {!loaded && !err ? <AppLoader label="Loading your sales" /> : (
        <DaySales eyebrow="Your earnings" total={total} days={rows} today={dayKey} empty="No finished cuts in this range." />
      )}
      {data && data.unclaimedCash ? (
        <section className="mt-3 flex items-center justify-between rounded-card bg-surface px-4 py-3.5 shadow-card" aria-label="Cash to hand to the shop">
          <span className="text-[13.5px] font-semibold">Cash to hand over</span>
          <b className="text-[17px] tabular-nums">{peso(data.unclaimedCash)}</b>
        </section>
      ) : null}
    </main>
  );
}
