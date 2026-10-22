"use client";
import { CalendarDays, ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { AppLoader } from "@/components/common/app-loader";
import { useEffect, useState } from "react";
import { historyRange, type BarberPerformance, type HistoryPreset as Preset } from "@/lib/barber-sales";
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

/** The barber's own My sales page (from the header icon): today only (Manila day, resets at midnight PHT). Past days live in History. */
export function BarberPerformanceView({ token, who, place, onBack, extra }: { token: string; who: string; place?: string; onBack: () => void; extra?: React.ReactNode }) {
  const [history, setHistory] = useState(false);
  // Re-key at Manila midnight so "today" rolls over while the page stays open.
  const [dayKey, setDayKey] = useState(() => ymd(Date.now()));
  useEffect(() => { const t = window.setInterval(() => setDayKey(ymd(Date.now())), 60_000); return () => window.clearInterval(t); }, []);
  const { data, err } = usePerformance(token, `range=today&d=${dayKey}`);
  if (history) return <BarberHistoryView token={token} who={who} place={place} onBack={() => setHistory(false)} />;
  if (!data && !err) return <AppLoader label="Loading your sales" />;
  const d = data;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">My sales</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{[who, place].filter(Boolean).join(" · ")}{d ? ` · ${d.label}` : ""}</p>
        </div>
      </div>
      {extra}
      {err && !d ? <p className="mt-4 text-[13.5px] font-semibold">{err}</p> : null}

      <EarningsCard d={d} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MiniStat label="Cuts" value={d ? String(d.cuts) : "–"} />
        <MiniStat label="Avg time" value={d?.avgMins == null ? "–" : `${d.avgMins < 1 ? "<1" : d.avgMins} min`} icon={<Timer size={16} strokeWidth={2.2} />} />
      </div>
      <button type="button" onClick={() => setHistory(true)} className="mt-3 flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-left shadow-card">
        <CalendarDays size={20} strokeWidth={2} aria-hidden />
        <b className="flex-1 text-[15px]">History</b>
        <ChevronRight size={20} className="text-muted" aria-hidden />
      </button>
      {d && d.unclaimedCash ? (
        <section className="mt-3 flex items-center justify-between rounded-card bg-surface px-4 py-3.5 shadow-card" aria-label="Cash to hand to the shop">
          <span className="text-[13.5px] font-semibold">Cash to hand over</span>
          <b className="text-[17px] tabular-nums">{peso(d.unclaimedCash)}</b>
        </section>
      ) : null}
      {d && d.services.length ? (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card" aria-label="By service">
          {d.services.map((x) => (
            <li key={x.name} className="flex items-center justify-between gap-3 px-4 py-3"><span className="min-w-0 truncate text-[14px] font-semibold">{x.name} <span className="text-muted">× {x.cuts}</span></span><b className="tabular-nums">{peso(x.sales)}</b></li>
          ))}
        </ul>
      ) : d ? <p className="mt-3 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No cuts yet today.</p> : null}
    </main>
  );
}


function MiniStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface px-4 py-3 shadow-card">
      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-muted">{icon}{label}</span>
      <b className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums">{value}</b>
    </div>
  );
}

/** Hero: what the barber takes home today. Split None = sales + tips. */
function EarningsCard({ d }: { d: BarberPerformance | null }) {
  const pct = d?.sharePct ?? null;
  const mine = pct == null ? (d?.sales ?? 0) + (d?.tips ?? 0) : (d?.barberShare ?? 0) + (d?.tips ?? 0);
  return (
    <section aria-label="Your earnings" className="mt-4 rounded-banner bg-ink px-4 py-4 text-on-ink">
      <p className="text-[12.5px] font-semibold text-on-ink-muted">Your earnings</p>
      <b className="mt-0.5 block text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{d ? peso(mine) : "–"}</b>
      {pct != null ? (
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/15" aria-hidden><span className="h-full bg-[#22c55e]" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2 flex justify-between text-[12.5px] font-semibold text-on-ink-muted">
            <span>You {pct}% <b className="text-on-ink tabular-nums">{peso(d?.barberShare ?? 0)}</b></span>
            <span>Shop <b className="text-on-ink tabular-nums">{peso(d?.shopShare ?? 0)}</b></span>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex justify-between border-t border-white/15 pt-3 text-[12.5px] font-semibold text-on-ink-muted">
        <span>Sales <b className="text-on-ink tabular-nums">{peso(d?.sales ?? 0)}</b></span>
        <span>Tips <b className="text-on-ink tabular-nums">{peso(d?.tips ?? 0)}</b></span>
      </div>
    </section>
  );
}

const PRESETS: [Preset, string][] = [["7", "Last 7 days"], ["30", "Last 30 days"], ["month", "This month"], ["lastMonth", "Last month"], ["custom", "Custom"]];
const longDay = (date: string) => new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

/** History: past days (newest first) with a date range and a total for that range. */
export function BarberHistoryView({ token, who, place, onBack }: { token: string; who: string; place?: string; onBack: () => void }) {
  const [preset, setPreset] = useState<Preset>("7");
  const [custom, setCustom] = useState(() => historyRange("7"));
  const [now] = useState(() => Date.now());
  const today = ymd(now);
  const r = historyRange(preset, now, custom);
  const { data: d, err } = usePerformance(token, `range=custom&from=${r.from}&to=${r.to}`);
  const pct = d?.sharePct ?? null;
  const loading = !d || d.from !== Date.parse(`${r.from}T00:00:00+08:00`);
  const earn = d ? (pct == null ? d.sales : (d.barberShare ?? 0)) + (d.tips ?? 0) : 0;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">History</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{[who, place].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Date range">
        {PRESETS.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={preset === v} onClick={() => setPreset(v)} className={`h-9 flex-none rounded-pill px-3.5 text-[13px] font-bold ${preset === v ? "bg-ink text-on-ink" : "bg-surface text-ink shadow-card"}`}>{l}</button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[12px] font-semibold text-muted">From<input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className="mt-1 h-10 w-full rounded-[12px] bg-surface px-2 text-[14px] font-semibold text-ink shadow-card" /></label>
          <label className="text-[12px] font-semibold text-muted">To<input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className="mt-1 h-10 w-full rounded-[12px] bg-surface px-2 text-[14px] font-semibold text-ink shadow-card" /></label>
        </div>
      ) : null}
      {err && !d ? <p className="mt-4 text-[13.5px] font-semibold">{err}</p> : null}
      {!d && !err ? <AppLoader label="Loading history" /> : d ? (
        <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <section aria-label="Total for this range" className="mt-4 rounded-banner bg-ink px-4 py-4 text-on-ink">
            <p className="text-[12.5px] font-semibold text-on-ink-muted">{longDay(r.from)} – {longDay(r.to)}</p>
            <b className="block text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(earn)}</b>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
              <span className="rounded-[14px] bg-white/10 px-2.5 py-2"><span className="block font-semibold text-on-ink-muted">Sales</span><b className="text-[15px] tabular-nums">{peso(d.sales)}</b></span>
              <span className="rounded-[14px] bg-white/10 px-2.5 py-2"><span className="block font-semibold text-on-ink-muted">Tips</span><b className="text-[15px] tabular-nums">{peso(d.tips ?? 0)}</b></span>
              <span className="rounded-[14px] bg-white/10 px-2.5 py-2"><span className="block font-semibold text-on-ink-muted">Cuts</span><b className="text-[15px] tabular-nums">{d.cuts}</b></span>
            </div>
          </section>
          {d.byDate?.length ? (
            <ul className="mt-4 overflow-hidden rounded-card bg-surface shadow-card" aria-label="Days">
              {d.byDate.map((x) => (
                <li key={x.date} className="border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[14.5px]">{x.date === today ? `Today, ${longDay(x.date).split(", ")[1]}` : longDay(x.date)}</b>
                    <b className="text-[15px] tabular-nums">{peso(x.earnings)}</b>
                  </div>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{x.cuts} cut{x.cuts === 1 ? "" : "s"} · {peso(x.sales)} sales{x.tips ? ` · ${peso(x.tips)} tips` : ""}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts in this range.</p>}
        </div>
      ) : null}
    </main>
  );
}
