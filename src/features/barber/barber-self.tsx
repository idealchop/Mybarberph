"use client";
import { useNow } from "@/lib/use-now";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/common/button";
import { useEffect, useState } from "react";
import type { BarberPerformance } from "@/lib/barber-sales";
import { compactPeso, weekBounds } from "@/lib/profit-report";
import { peso } from "@/lib/format";
import { cellClaimState } from "@/lib/profit-claim";

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

/**
 * My sales (v1.0.21): the owner's Weekly Profit Report view for one barber. Mon–Sun, week arrows, the barber's
 * split only (their share + tips; full price when the shop set no split). No groups, no location switch.
 */
export function BarberPerformanceView({ token, who, place, onBack, extra, onProfile }: { token: string; who: string; place?: string; onBack: () => void; extra?: React.ReactNode; onProfile?: () => void }) {
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const wk = weekBounds(offset, now);
  const from = wk.days[0]!.key, to = wk.days[6]!.key;
  const today = ymd(now);
  const { data, err } = usePerformance(token, `range=custom&from=${from}&to=${to}&d=${today}`);
  const by = new Map((data?.byDate ?? []).map((x) => [x.date, x]));
  const days = wk.days.map((d) => ({ ...d, amount: by.get(d.key)?.earnings ?? 0, cuts: by.get(d.key)?.cuts ?? 0, st: cellClaimState({ open: by.get(d.key)?.cashOpen ?? 0, claimed: by.get(d.key)?.cashClaimed ?? 0 }), future: d.key > today, today: d.key === today }));
  const total = days.reduce((s, d) => s + d.amount, 0);
  const cuts = days.reduce((s, d) => s + d.cuts, 0);
  const tips = (data?.byDate ?? []).filter((x) => x.date >= from && x.date <= to).reduce((s, x) => s + (x.tips ?? 0), 0);
  const loaded = data?.from === wk.from;
  const short = wk.label.replace(/, \d{4}$/, "");
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">My sales</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{[who, place].filter(Boolean).join(" · ")}</p>
        </div>
        {onProfile ? <Button className="ml-auto flex-none" variant="secondary" size="sm" pill leadingIcon={<UserRound size={15} strokeWidth={2.2} aria-hidden />} onClick={onProfile}>Performance</Button> : null}
      </div>
      <section aria-label="Your earnings" className="mt-3 rounded-banner bg-ink py-3 pl-4 pr-2 text-on-ink">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[12.5px] font-semibold text-on-ink-muted">Your share</p>
          <div role="group" aria-label="Week" className="flex h-11 flex-none items-center rounded-pill bg-white/10">
            <button type="button" aria-label="Previous week" disabled={offset <= -8} onClick={() => setOffset((n) => Math.max(-8, n - 1))}
              className="inline-flex size-11 items-center justify-center rounded-full text-on-ink active:bg-white/15 disabled:opacity-30"><ChevronLeftIcon /></button>
            <span aria-live="polite" className="whitespace-nowrap text-[12.5px] font-bold tabular-nums">{short}</span>
            <button type="button" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset((n) => Math.min(0, n + 1))}
              className="inline-flex size-11 items-center justify-center rounded-full text-on-ink active:bg-white/15 disabled:opacity-30"><ChevronRight size={17} strokeWidth={2.4} /></button>
          </div>
        </div>
        <b className="mt-1 block pr-2 text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{loaded ? peso(total) : "…"}</b>
        <p className="mb-1 mt-2 pr-2 text-[12.5px] font-semibold text-on-ink-muted">{!loaded ? "Loading…" : cuts ? `${cuts} haircut${cuts === 1 ? "" : "s"}${tips ? ` · Tips ${peso(tips)}` : ""}` : "No finished haircuts"}</p>
      </section>
      {err && !data ? <p className="mt-4 text-[13.5px] font-semibold">{err}</p> : null}
      <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
        <table className="w-full table-fixed border-separate border-spacing-0 text-[11.5px]">
          <thead>
            <tr className="text-[10.5px] font-bold text-on-ink">
              {days.map((d) => (
                <th key={d.key} scope="col" className={`bg-ink px-0 py-1.5 text-center font-bold ${d.today ? "bg-[#333]" : ""}`}>
                  <span className="block leading-tight">{d.dow}</span>
                  <span className={`block text-[9.5px] font-semibold leading-tight ${d.today ? "text-white" : "text-on-ink-muted"}`}>{d.today ? "Today" : d.date.slice(0, 5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {days.map((d) => (
                <td key={d.key} className={`border-b border-line px-0 py-3 text-center tabular-nums ${d.today ? "bg-grey-100" : ""} ${d.today ? "shadow-[inset_0_0_0_1.5px_#111]" : ""}`}>
                  {d.future || !loaded ? <span className="text-muted opacity-40">–</span> : d.amount ? (
                    <><b className={`block text-[12px] font-bold ${d.st === "open" ? "text-[#C62828]" : d.st === "claimed" ? "text-[#0B7A3E]" : ""}`}>{compactPeso(d.amount)}</b><small className="block text-[10px] font-semibold text-muted">{d.cuts} haircut{d.cuts === 1 ? "" : "s"}</small></>
                  ) : <span className="font-semibold text-muted">–</span>}
                </td>
              ))}
            </tr>
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <th scope="row" colSpan={5} className="bg-grey-100 py-3 pl-3 text-left">Week total</th>
              <td colSpan={2} className="bg-grey-100 py-3 pr-3 text-right tabular-nums">{peso(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 flex items-center justify-end gap-3 px-1 text-[11px] font-semibold text-muted" aria-label="Colour key">
        <span className="flex items-center gap-1"><i aria-hidden className="size-1.5 rounded-full bg-[#0B7A3E]" /><span className="text-[#0B7A3E]">Claimed</span></span>
        <span className="flex items-center gap-1"><i aria-hidden className="size-1.5 rounded-full bg-[#C62828]" /><span className="text-[#C62828]">To hand over</span></span>
      </p>
      {loaded && data?.unclaimedOwner ? (
        <section className="mt-3 flex items-center justify-between rounded-card bg-surface px-4 py-3.5 shadow-card" aria-label="Cash to hand to the owner">
          <span className="text-[13.5px] font-semibold">Hand over to owner</span>
          <b className="text-[17px] tabular-nums">{peso(data.unclaimedOwner)}</b>
        </section>
      ) : null}
      {extra}
    </main>
  );
}

function ChevronLeftIcon() { return <ChevronLeft size={17} strokeWidth={2.4} />; }
