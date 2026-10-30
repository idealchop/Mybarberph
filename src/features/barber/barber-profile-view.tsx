"use client";
import { ChevronLeft, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@river-apps/ui";
import type { BarberProfile } from "@/lib/barber-sales";
import { peso } from "@/lib/format";
import { SalesChartCard } from "@/features/sales/sales-chart";

type Range = "today" | "7d" | "all";
const RANGES: [Range, string][] = [["today", "Today"], ["7d", "7d"], ["all", "All time"]];
const MEDAL = ["🥇", "🥈", "🥉"];
const hLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const dLabel = (d: string) => new Date(`${d}T00:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** The barber's own profile (v1.0.22): the owner's barber detail, read-only, with the barber's share + tips. */
export function BarberProfileView({ token, who, place, onBack }: { token: string; who: string; place?: string; onBack: () => void }) {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<BarberProfile | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/barber/${token}/profile?range=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn’t load your performance."))))
      .then((d: BarberProfile) => { if (live) { setData(d); setErr(""); } })
      .catch((e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [token, range]);
  const d = data?.range === range ? data : null;
  const pct = d?.sharePct ?? null;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">{who}</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{place || "My performance"}</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Range" className="mt-3 flex gap-1.5">
        {RANGES.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={range === k} onClick={() => setRange(k)}
            className={cn("h-9 rounded-pill px-3.5 text-[13.5px] font-bold shadow-card", range === k ? "bg-ink text-on-ink" : "bg-surface text-ink")}>{l}</button>
        ))}
      </div>
      {err && !d ? <p className="mt-4 text-[13.5px] font-semibold">{err}</p> : null}
      <section className="mt-3 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
        <span aria-hidden className="flex size-[52px] flex-none items-center justify-center rounded-full bg-grey-100 text-muted"><UserRound size={26} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-muted">{d ? `Rank among ${d.of} barber${d.of === 1 ? "" : "s"}` : "Rank"}</p>
          <b className="flex items-center gap-1.5 text-[22px] tracking-[-0.02em]">{d?.rank && d.rank <= 3 ? <span className="text-[24px]">{MEDAL[d.rank - 1]}</span> : null}#{d?.rank ?? "–"}</b>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-muted">Your share</p>
          <b className="block text-[18px] tabular-nums">{!d ? "…" : pct == null ? "Not set" : `${pct}%`}</b>
          <small className="block text-[11px] font-semibold text-muted">{pct == null ? "Full price + tips" : "+ 100% of tips"}</small>
        </div>
      </section>
      <div className="mt-3 grid grid-cols-3 gap-2 [&>*]:min-w-0">
        <Mini k="Haircuts/hr" v={d?.perHour == null ? "–" : String(d.perHour)} />
        <Mini k="To hand over" v={d ? peso(d.toClaim) : "–"} tone={d && d.toClaim > 0 ? "warn" : undefined} />
        <Mini k="Handed over" v={d ? peso(d.claimed) : "–"} />
      </div>
      {d && range !== "today" ? <SalesChartCard className="mt-3" kind="day" sales={d.earnings} series={d.byDate.map((x) => ({ label: dLabel(x.date), orders: x.cuts, salesCentavos: x.earnings, detail: `${x.cuts} haircut${x.cuts === 1 ? "" : "s"}` }))} /> : null}
      <div className="mt-3 grid grid-cols-2 gap-2 [&>*]:min-w-0">
        <Kpi k="Your earnings" v={d ? peso(d.earnings) : "…"} sub={d ? `${peso(d.share)} share + ${peso(d.tips)} tips` : ""} />
        <Kpi k="Haircuts" v={d ? String(d.cuts) : "…"} />
        <Kpi k="Avg per haircut" v={d ? (d.cuts ? peso(d.avgTicket) : "–") : "…"} sub="Your share + tips" />
        <Kpi k="Peak hour" v={d?.peakHour ? hLabel(d.peakHour.hour) : "–"} sub={d?.peakHour ? `${d.peakHour.cuts} haircut${d.peakHour.cuts === 1 ? "" : "s"}` : ""} />
      </div>
      {d && d.byHour.length ? <SalesChartCard className="mt-3" kind="hour" sales={d.earnings} series={d.byHour.map((h) => ({ label: hLabel(h.hour), orders: h.cuts, salesCentavos: h.earnings, detail: `${h.cuts} haircut${h.cuts === 1 ? "" : "s"}` }))} /> : null}
      <p className="mt-4 text-center text-[12px] font-semibold text-muted">Amounts are your share of each haircut plus your tips.</p>
    </main>
  );
}

function Mini({ k, v, tone }: { k: string; v: string; tone?: "warn" }) {
  return <div className="rounded-card bg-surface px-3 py-2.5 shadow-card"><p className="truncate text-[11.5px] font-semibold text-muted">{k}</p><b className={cn("block truncate text-[16px] tabular-nums", tone === "warn" && "text-[#B54708]")}>{v}</b></div>;
}
function Kpi({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return <div className="rounded-card bg-surface px-4 py-3 shadow-card"><p className="truncate text-[12.5px] font-semibold text-muted">{k}</p><b className="block truncate text-[22px] tabular-nums tracking-[-0.02em]">{v}</b>{sub ? <small className="block truncate text-[11.5px] font-semibold text-muted">{sub}</small> : null}</div>;
}
