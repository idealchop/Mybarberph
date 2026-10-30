"use client";
import { AppLoader } from "@/components/common/app-loader";
import { StatCard } from "@river-apps/ui";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { rangeFetchDays, setCustomRange, type SalesRange } from "@/lib/sales-report";
import { BarberDetail } from "./barber-detail";
import { barberKey, barberStats, busyMinutes, dailySeries, inRange, locationStats, serviceStats } from "@/lib/sales-stats";
import { SalesChartCard } from "./sales-chart";
import { ClaimHistory, RangeChips } from "./sales-parts";
import { useRemit } from "./use-remit";
import { useSalesRows } from "./use-sales-rows";
import { mergeLiveRows } from "@/lib/cut-count";
import { asOwnerSplit } from "@/lib/split-view";

/** Personal detail page for one location or one barber: sales, cuts, cash/GCash, remit, completion, trends. */
export function SalesDetailScreen() {
  const q = useSearchParams();
  const kind = q.get("kind") === "barber" ? "barber" : "location";
  const id = q.get("id") || "";
  const locHint = q.get("loc") || "";
  // `?day=YYYY-MM-DD` (from the profit report's day cells) opens focused on that one Manila day.
  const [range, setRange] = useState<SalesRange>(() => {
    const day = q.get("day") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) { setCustomRange(day, day); return "custom"; }
    return (q.get("r") as SalesRange) || "week";
  });
  const shops = useShopLocations();
  const { profile } = useShopProfile();
  const { chairs } = useShopChairs({ all: true });
  const deep = useSalesRows(rangeFetchDays(range));
  const cloud = useChairRequests();
  // History plus live rows, so a cut the barber just finished shows here at once (as on their link).
  const all = useMemo(() => asOwnerSplit(mergeLiveRows(deep, cloud.rows), chairs), [deep, cloud.rows, chairs]);
  const branches = useMemo(() => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]), [shops.enabled, shops.branches, profile.name]);

  const title = useMemo(() => {
    if (kind === "location") return branches.find((b) => b.id === id)?.name || "Location";
    const b = barberStats(all, range, locHint || "all", branches, chairs).find((x) => x.id === id && (!locHint || x.locationId === locHint));
    return b?.name || "Barber";
  }, [kind, id, locHint, all, range, branches, chairs]);

  const sub = kind === "barber" ? (branches.find((b) => b.id === (locHint || ""))?.name || "") : "Location";
  const loc = kind === "location" ? id : (locHint || "all");
  const stats = kind === "location"
    ? locationStats(all, range, branches).find((l) => l.id === id)
    : barberStats(all, range, loc, branches, chairs).find((b) => b.id === id);
  const mine = (r: (typeof all)[number]) => kind !== "barber" || barberKey(r, chairs) === id;
  const scoped = all.filter(mine);
  const busy = busyMinutes(inRange(scoped, range, loc));
  const days = range === "today" ? 1 : range === "week" ? 7 : 28; // utilization (location view only)
  const util = kind === "barber" && busy ? Math.min(100, Math.round((busy / (days * 600)) * 100)) : null;
  const series = dailySeries(all, range, loc, mine).map((d) => ({ label: d.label, orders: d.cuts, salesCentavos: d.sales, detail: `${d.cuts} haircuts` }));
  const services = serviceStats(scoped, range, loc).slice(0, 6);
  const remit = useRemit(kind === "barber" ? "all" : id || "all");
  const toClaim = (remit.data?.unclaimed ?? []).filter((u) => kind !== "barber" || (u.barberId === id && (!locHint || u.locationId === locHint))).reduce((s, u) => s + (u.ownerShare ?? u.amount), 0);

  if (!deep && !cloud.ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1 px-1">
        <PageBack fallback={`/sales?view=services&loc=${encodeURIComponent(locHint || (kind === "location" ? "all" : loc))}&r=${range}`} />
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>
          {sub ? <p className="text-[13px] font-semibold text-muted">{sub}</p> : null}
        </div>
      </div>
      <RangeChips className="mt-3" value={range} onChange={setRange} allowCustom />
      {kind === "barber" ? <BarberDetail id={id} all={all} range={range} chairs={chairs} branches={branches} remit={remit.data} /> : !stats ? <p className="mt-6 text-[14px] font-semibold text-muted">No finished haircuts in this range.</p> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard className="col-span-2 pb-3" label="Sales" value={<span className="text-[28px] leading-none tracking-[-0.03em]">{peso(stats.sales)}</span>} caption={`${stats.cuts} haircut${stats.cuts === 1 ? "" : "s"}`} />
            <StatCard className="pb-3" label="Avg ticket" value={peso(stats.avg)} />
            <StatCard className="pb-3" label="Completion" value={stats.completionPct == null ? "–" : `${stats.completionPct}%`} />
            <StatCard className="pb-3" label="Cash" value={peso(stats.cash)} />
            <StatCard className="pb-3" label="GCash" value={peso(stats.gcash)} />
            {stats.online ? <StatCard className="pb-3" label="Online" value={peso(stats.online)} /> : null}
            {stats.other ? <StatCard className="pb-3" label="Other" value={peso(stats.other)} caption="No method saved" /> : null}
            {"remit" in stats ? <StatCard className="col-span-2 pb-3" label="Remit (cash collected)" value={peso((stats as { remit: number }).remit)} caption={remit.data ? (toClaim ? `${peso(toClaim)} still to claim` : "All claimed by owner") : undefined} /> : null}
            {busy ? <StatCard className="pb-3" label="Busy time" value={`${Math.floor(busy / 60)}h ${busy % 60}m`} /> : null}
            {util != null ? <StatCard className="pb-3" label="Utilization" value={`${util}%`} caption="of 10-h days" /> : null}
            {"unpaid" in stats && stats.unpaid ? <StatCard className="col-span-2 pb-3" label="Unpaid" value={peso(stats.unpaid)} /> : null}
          </div>
          <SalesChartCard className="mt-3" series={series} kind={range === "today" ? "hour" : "day"} sales={stats.sales} />
          {services.length ? (
            <section className="mt-5">
              <h2 className="px-1 text-[13px] font-bold text-muted">Top services</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card">
                    <span><b className="block text-[14.5px]">{s.name}</b><small className="text-[12px] font-semibold text-muted">{s.cuts} · avg {peso(s.avg)}{s.completionPct != null ? ` · ${s.completionPct}% done` : ""}</small></span>
                    <b className="tabular-nums">{peso(s.sales)}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <ClaimHistory remit={remit.data} barberId={undefined} max={10} />
        </>
      )}
    </div>
  );
}
