"use client";
import { SegmentedControl, StatCard } from "@river-apps/ui";
import { useEffect, useState } from "react";
import { api } from "@/lib/cloud";
import { peso } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useShopLocations } from "@/lib/shop-locations";

type Range = "today" | "7d" | "28d";
interface ChairRow { chair: string; barber: string; locationId: string; location: string; cuts: number; salesCentavos: number; avgTicketCentavos: number; utilizationPct: number | null; rebookingPct: number | null }
interface Perf { chairs: ChairRow[]; totals: { salesCentavos: number; cuts: number; avgTicketCentavos: number } }

const pct = (v: number | null) => (v == null ? "–" : `${v}%`);

/** Chair & barber performance for one location (or all), from real visits only. Lives on Sales → Performance. */
export function PerformanceBody({ loc }: { loc: string }) {
  const { user } = useSession();
  const shops = useShopLocations();
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<Perf | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    let live = true;
    api(`/api/shop/performance?loc=${encodeURIComponent(loc)}&range=${range}`)
      .then((d) => { if (live) { setData(d); setError(""); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [user, loc, range]);
  const showLoc = loc === "all" && shops.branches.length > 1;
  return (
    <section aria-label="Barber performance">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Chairs</h2>
      </div>
      <SegmentedControl className="mt-2 w-fit" label="Range" value={range} onChange={(v) => setRange(v as Range)} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "28d", label: "28 days" }]} />
      {error ? <p className="mt-3 text-[13px] font-semibold">{error}</p> : null}
      {!user ? <p className="mt-4 text-[13px] font-semibold text-muted">Sign in to see your chairs.</p> : !data ? <p className="mt-4 text-[13px] font-semibold text-muted">Loading…</p> : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatCard className="pb-3" label="Sales" value={peso(data.totals.salesCentavos)} />
            <StatCard className="pb-3" label="Cuts" value={String(data.totals.cuts)} />
            <StatCard className="pb-3" label="Avg ticket" value={peso(data.totals.avgTicketCentavos)} />
          </div>
          {data.chairs.length === 0 ? (
            <p className="mt-3 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No chairs or visits yet for this range.</p>
          ) : (
            <ul className="mt-3 grid gap-2.5 lg:grid-cols-2">
              {data.chairs.map((c) => (
                <li key={`${c.locationId}-${c.chair}`} className="rounded-card bg-surface px-4 py-3.5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <b className="block truncate text-[15.5px]">{c.chair} · {c.barber}</b>
                      {showLoc ? <small className="text-[12.5px] font-semibold text-muted">{c.location}</small> : null}
                    </span>
                    <b className="text-[16px] tabular-nums">{peso(c.salesCentavos)}</b>
                  </div>
                  <dl className="mt-2.5 grid grid-cols-4 gap-2 text-center">
                    {[["Cuts", String(c.cuts)], ["Avg", peso(c.avgTicketCentavos)], ["Busy time", pct(c.utilizationPct)], ["Rebook", pct(c.rebookingPct)]].map(([k, v]) => (
                      <div key={k} className="rounded-[12px] bg-grey-100 px-1 py-2">
                        <dt className="text-[11px] font-bold text-muted">{k}</dt>
                        <dd className="text-[14px] font-extrabold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 px-1 text-[12px] font-medium text-muted">Chair use = minutes seated ÷ 10-hour days the chair worked. Rebook = customers who came back after a visit in that chair.</p>
        </>
      )}
    </section>
  );
}
