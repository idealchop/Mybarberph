"use client";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { AppLoader } from "@/components/common/app-loader";
import { useEffect, useState } from "react";
import { historyRange, type BarberPerformance, type HistoryPreset as Preset } from "@/lib/barber-sales";
import { peso } from "@/lib/format";
import { PaySplitText } from "@/features/sales";

const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

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
  const maxHour = Math.max(1, ...(d?.hours.map((h) => h.cuts) ?? [1]));
  const top = d?.hours.slice().sort((a, b) => b.cuts - a.cuts)[0];
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
      <SpeedCard d={d} />
      <button type="button" onClick={() => setHistory(true)} className="mt-3 flex w-full items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-left shadow-card">
        <span aria-hidden className="inline-flex size-11 flex-none items-center justify-center rounded-[14px] bg-grey-100"><CalendarDays size={22} strokeWidth={2} /></span>
        <span className="min-w-0 flex-1"><b className="block text-[15px]">History</b><small className="text-[12.5px] font-semibold text-muted">Past days, earnings and tips</small></span>
        <ChevronRight size={20} className="text-muted" aria-hidden />
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat wide k="Sales" v={d ? peso(d.sales) : "–"} sub={d ? `${d.cuts} cut${d.cuts === 1 ? "" : "s"}` : undefined} />
        <Stat k="Avg ticket" v={d ? peso(d.avg) : "–"} />
        <Stat k="Completion" v={d?.completionPct == null ? "–" : `${d.completionPct}%`} />
        <div className="col-span-2 rounded-[14px] bg-surface px-3 py-2.5 shadow-card">
          <p className="text-[12px] font-semibold text-muted">Collected</p>
          <b className="text-[24px] tracking-[-0.03em]">{d ? peso(d.cash + d.gcash + d.online + (d.other ?? 0)) : "–"}</b>
          {d ? <PaySplitText split={{ cash: d.cash, gcash: d.gcash, online: d.online, other: d.other ?? 0 }} layout="lines" className="text-[13px] font-semibold text-muted" /> : null}
        </div>
        <Stat k="Walk-ins" v={d ? String(d.walkIns) : "–"} />
        <Stat k="Online" v={d ? String(d.onlineBookings) : "–"} />
      </div>

      <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Cash to hand to the shop">
        <b className="text-[15px]">Cash to hand to the shop</b>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-ink px-3 py-2.5 text-on-ink"><p className="text-[12px] font-semibold opacity-80">Still to hand over</p><b className="text-[18px]">{d ? peso(d.unclaimedCash) : "–"}</b></div>
          <div className="rounded-[12px] bg-grey-100 px-3 py-2.5"><p className="text-[12px] font-semibold text-muted">Claimed by owner</p><b className="text-[18px]">{d ? peso(d.claimedCash) : "–"}</b></div>
        </div>
        {d && d.unpaid ? <p className="mt-2 text-[12.5px] font-semibold text-muted">Not paid yet: {peso(d.unpaid)}</p> : null}
        {d?.claims.length ? (
          <ul className="mt-3 border-t border-line">
            {d.claims.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <small className="flex items-center gap-1 text-[12.5px] font-semibold text-muted"><Check size={12} strokeWidth={3} />Claimed by owner · {day(c.claimedAt)} · {c.count} cut{c.count === 1 ? "" : "s"}</small>
                <b className="text-[14px] tabular-nums">{peso(c.amount)}</b>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {d && d.cuts ? (
        <>
          <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Busiest hours">
            <div className="flex items-baseline justify-between"><b className="text-[15px]">Busiest hours</b>{top ? <small className="text-[12px] font-semibold text-muted">Peak {hourLabel(top.hour)}</small> : null}</div>
            <div className="mt-3 flex h-[80px] items-end gap-1">
              {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => { const c = d.hours.find((x) => x.hour === h)?.cuts ?? 0; return (
                <div key={h} className="flex flex-1 flex-col items-center gap-1"><span className="w-full rounded-t-[4px] bg-ink" style={{ height: `${Math.max(3, (c / maxHour) * 64)}px`, opacity: c ? 1 : 0.15 }} title={`${hourLabel(h)}: ${c}`} /><small className="text-[9px] font-bold text-muted">{h % 2 ? "" : hourLabel(h)}</small></div>
              ); })}
            </div>
          </section>
          <section className="mt-4" aria-label="Services">
            <h2 className="px-1 text-[13px] font-bold text-muted">By service</h2>
            <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
              {d.services.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0"><span className="min-w-0"><b className="block truncate text-[14px]">{s.name}</b><small className="text-[12px] font-semibold text-muted">{s.cuts} cut{s.cuts === 1 ? "" : "s"}</small></span><b className="tabular-nums">{peso(s.sales)}</b></li>
              ))}
            </ul>
          </section>
        </>
      ) : d ? <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts yet today.</p> : null}
    </main>
  );
}

function Stat({ k, v, sub, wide }: { k: string; v: string; sub?: string; wide?: boolean }) {
  return (
    <div className={`rounded-[14px] bg-surface px-3 py-2.5 shadow-card ${wide ? "col-span-2" : ""}`}>
      <p className="text-[12px] font-semibold text-muted">{k}</p>
      <b className={wide ? "text-[24px] tracking-[-0.03em]" : "text-[17px] tracking-[-0.02em]"}>{v}</b>
      {sub ? <small className="ml-2 text-[12.5px] font-semibold text-muted">{sub}</small> : null}
    </div>
  );
}

/** Main card (Jimboy, 2026-10-21): what the barber takes home. Share % of sales + 100% of tips. */
function EarningsCard({ d }: { d: BarberPerformance | null }) {
  const pct = d?.sharePct ?? null;
  // None (no split set): just sales + tips, no barber/shop shares.
  const mine = pct == null ? (d?.sales ?? 0) + (d?.tips ?? 0) : (d?.barberShare ?? 0) + (d?.tips ?? 0);
  return (
    <section aria-label="Your earnings" className="relative isolate mt-4 overflow-hidden rounded-banner bg-ink px-4 py-4 text-on-ink">
      <p className="text-[12.5px] font-semibold text-on-ink-muted">{pct == null ? "Your sales + tips" : "Your earnings"}</p>
      <b className="mt-0.5 block text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{d ? peso(mine) : "–"}</b>
      <p className="mt-1 text-[12.5px] font-semibold text-on-ink-muted">{pct == null ? "No income split is set" : `${pct}% of sales${d?.tips ? " + all your tips" : ""}`}</p>
      {pct == null ? (
        <div className="mt-3 flex items-center justify-between rounded-[16px] bg-white/10 px-3 py-2.5">
          <span className="text-[12.5px] font-semibold text-on-ink-muted">Sales</span>
          <b className="text-[17px] tabular-nums">{d ? peso(d.sales) : "–"}</b>
        </div>
      ) : (
        <div className="mt-3 rounded-[16px] bg-white/10 px-3 py-2.5">
          <p className="text-[12.5px] font-semibold text-on-ink-muted">Sales {d ? peso(d.sales) : "–"} split {pct} / {100 - pct}</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
            <span className="h-full bg-[#22c55e]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
            <span><span className="block font-semibold text-on-ink-muted">You · {pct}%</span><b className="text-[17px] tabular-nums">{d ? peso(d.barberShare ?? 0) : "–"}</b></span>
            <span><span className="block font-semibold text-on-ink-muted">Shop · {100 - pct}%</span><b className="text-[17px] tabular-nums">{d ? peso(d.shopShare ?? 0) : "–"}</b></span>
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between rounded-[16px] bg-white/10 px-3 py-2.5">
        <span><span className="block text-[12.5px] font-semibold text-on-ink-muted">{pct == null ? "Tips" : "Tips · 100% yours"}</span><small className="text-[12px] font-semibold text-on-ink-muted">{d?.tipCount ? `${d.tipCount} tip${d.tipCount === 1 ? "" : "s"}` : "No tips yet"}</small></span>
        <b className="text-[17px] tabular-nums">{d ? peso(d.tips ?? 0) : "–"}</b>
      </div>
    </section>
  );
}

/** Speed: average time per cut (start to done). */
function SpeedCard({ d }: { d: BarberPerformance | null }) {
  const avg = d?.avgMins;
  return (
    <section aria-label="Speed" className="mt-3 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
      <span aria-hidden className="inline-flex size-11 flex-none items-center justify-center rounded-[14px] bg-grey-100"><Timer size={22} strokeWidth={2} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-muted">Average time per cut</span>
        <b className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums">{avg == null ? "–" : `${avg < 1 ? "<1" : avg} min`}</b>
      </span>
      <span className="text-right text-[12.5px] font-semibold text-muted">{d?.fastestMins != null ? <>Fastest<b className="block text-[15px] text-ink tabular-nums">{d.fastestMins < 1 ? "<1" : d.fastestMins} min</b></> : "Start to done"}{d?.timedCuts ? <small className="block">{d.timedCuts} timed</small> : null}</span>
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
            <p className="mt-2 text-[12.5px] font-semibold text-on-ink-muted">{pct == null ? "Your sales + tips" : "Your earnings"}</p>
            <b className="block text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(earn)}</b>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
              <span className="rounded-[14px] bg-white/10 px-2.5 py-2"><span className="block font-semibold text-on-ink-muted">Sales</span><b className="text-[15px] tabular-nums">{peso(d.sales)}</b></span>
              <span className="rounded-[14px] bg-white/10 px-2.5 py-2"><span className="block font-semibold text-on-ink-muted">{pct == null ? "Tips" : "Tips · yours"}</span><b className="text-[15px] tabular-nums">{peso(d.tips ?? 0)}</b></span>
              <span className="rounded-[14px] bg-white/10 px-2.5 py-2"><span className="block font-semibold text-on-ink-muted">Cuts</span><b className="text-[15px] tabular-nums">{d.cuts}</b></span>
            </div>
            {pct != null ? <p className="mt-2 text-[12px] font-semibold text-on-ink-muted">You {pct}% {peso(d.barberShare ?? 0)} · Shop {100 - pct}% {peso(d.shopShare ?? 0)}</p> : null}
          </section>
          {d.byDate?.length ? (
            <ul className="mt-4 overflow-hidden rounded-card bg-surface shadow-card" aria-label="Days">
              {d.byDate.map((x) => (
                <li key={x.date} className="border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[14.5px]">{x.date === today ? `Today, ${longDay(x.date).split(", ")[1]}` : longDay(x.date)}</b>
                    <b className="text-[15px] tabular-nums">{peso(x.earnings)}</b>
                  </div>
                  <div className="mt-0.5 flex justify-between gap-3 text-[12.5px] font-semibold text-muted">
                    <span>{x.cuts} cut{x.cuts === 1 ? "" : "s"} · Sales {peso(x.sales)}{x.tips ? ` · Tips ${peso(x.tips)}` : ""}</span>
                    <span>{pct == null ? "Sales + tips" : "Your earnings"}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts in this range.</p>}
        </div>
      ) : null}
    </main>
  );
}
