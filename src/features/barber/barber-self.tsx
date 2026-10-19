"use client";
import { Check, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { BarberPerformance } from "@/lib/barber-sales";
import { peso } from "@/lib/format";
import { PaySplitText } from "@/features/sales";

type Range = "week" | "month" | "custom";
const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

/** The barber's own My sales page (from the header icon). Week / month / custom. */
export function BarberPerformanceView({ token, who, place, onBack }: { token: string; who: string; place?: string; onBack: () => void }) {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState(() => ymd(Date.now() - 13 * 86_400_000));
  const [to, setTo] = useState(() => ymd(Date.now()));
  const [today] = useState(() => ymd(Date.now()));
  const [data, setData] = useState<BarberPerformance | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const qs = range === "custom" ? `range=custom&from=${from}&to=${to}` : `range=${range}`;
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
  }, [token, range, from, to]);
  const d = data;
  const maxHour = Math.max(1, ...(d?.hours.map((h) => h.cuts) ?? [1]));
  const maxDay = Math.max(1, ...(d?.days.map((x) => x.cuts) ?? [1]));
  const top = d?.hours.slice().sort((a, b) => b.cuts - a.cuts)[0];
  const topDay = d?.days.slice().sort((a, b) => b.cuts - a.cuts)[0];
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">My sales</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{[who, place].filter(Boolean).join(" · ")}{d ? ` · ${d.label}` : ""}</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Period" className="mt-3 grid grid-cols-3 rounded-pill bg-grey-100 p-1">
        {([["week", "This week"], ["month", "This month"], ["custom", "Custom"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={range === v} onClick={() => setRange(v)} className={`h-9 rounded-pill text-[13px] font-bold ${range === v ? "bg-surface text-ink shadow-card" : "text-muted"}`}>{l}</button>
        ))}
      </div>
      {range === "custom" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-muted">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] bg-surface px-2 text-[13px] font-semibold text-ink shadow-card" /></label>
          <label className="text-[11px] font-bold text-muted">To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] bg-surface px-2 text-[13px] font-semibold text-ink shadow-card" /></label>
        </div>
      ) : null}
      {err && !d ? <p className="mt-4 text-[13.5px] font-semibold">{err}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat wide k="Sales" v={d ? peso(d.sales) : "–"} sub={d ? `${d.cuts} cut${d.cuts === 1 ? "" : "s"}` : undefined} />
        <Stat k="Avg ticket" v={d ? peso(d.avg) : "–"} />
        <Stat k="Completion" v={d?.completionPct == null ? "–" : `${d.completionPct}%`} />
        <div className="col-span-2 rounded-[14px] bg-surface px-3 py-2.5 shadow-card">
          <p className="text-[12px] font-semibold text-muted">Collected</p>
          <b className="text-[24px] tracking-[-0.03em]">{d ? peso(d.cash + d.gcash + d.online + (d.other ?? 0)) : "–"}</b>
          {d ? <PaySplitText split={{ cash: d.cash, gcash: d.gcash, online: d.online, other: d.other ?? 0 }} layout="lines" className="text-[13px] font-semibold text-muted" /> : null}
          {d?.tips ? <p className="mt-0.5 text-[12px] font-semibold text-muted">incl. {peso(d.tips)} tips</p> : null}
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
          <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Busiest days">
            <div className="flex items-baseline justify-between"><b className="text-[15px]">Busiest days</b>{topDay?.cuts ? <small className="text-[12px] font-semibold text-muted">Most on {topDay.day}</small> : null}</div>
            <ul className="mt-2 grid gap-1.5">
              {d.days.map((x) => (
                <li key={x.day} className="flex items-center gap-2 text-[12.5px] font-semibold"><span className="w-8 text-muted">{x.day}</span><span className="h-2.5 flex-1 rounded-full bg-grey-100"><span className="block h-full rounded-full bg-ink" style={{ width: `${(x.cuts / maxDay) * 100}%` }} /></span><span className="w-20 text-right tabular-nums">{x.cuts} · {peso(x.sales)}</span></li>
              ))}
            </ul>
          </section>
          <section className="mt-4" aria-label="Services">
            <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">By service</h2>
            <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
              {d.services.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0"><span className="min-w-0"><b className="block truncate text-[14px]">{s.name}</b><small className="text-[12px] font-semibold text-muted">{s.cuts} cut{s.cuts === 1 ? "" : "s"}</small></span><b className="tabular-nums">{peso(s.sales)}</b></li>
              ))}
            </ul>
          </section>
        </>
      ) : d ? <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts in this period.</p> : null}
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
