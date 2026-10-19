"use client";
import { DashboardSkeleton } from "@/components/common/skeleton";
import { MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import { CoinIcon } from "@river-apps/icons";
import { StatCard, cn } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useEffect, useMemo, useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopProfile } from "@/lib/shop-profile";
import { chairBarberName, useShopChairs } from "@/lib/shop-chairs";
import { rangeFetchDays, salesReport, type SalesRange } from "@/lib/sales-report";
import { barberStats } from "@/lib/sales-stats";
import { BarberRanking, ClaimHistory, BarberSalesRanking, PaySplitText, RangeChips, UnclaimedCard } from "./sales-parts";
import { useRemit } from "./use-remit";
import { useSalesRows } from "./use-sales-rows";
import { PerfFilterButton, PerformanceDashboard, type PerfFilters } from "./performance-dashboard";

type View = "overview" | "performance" | "services";
const VIEWS: { value: View; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "performance", label: "Collection" },
  { value: "services", label: "Performance" },
];

/** Sales: Overview / Barbers / Services, filtered by location and a compact date chip. */
export function SalesDataScreen() {
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const { chairs } = useShopChairs({ all: true });
  const cloud = useChairRequests();
  const [range, setRange] = useState<SalesRange>("today");
  const deep = useSalesRows(rangeFetchDays(range));
  const all = deep ?? cloud.rows;
  const [loc, setLoc] = useState("");
  const where = loc || (shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const rows = all.filter((r) => where === "all" || (r.locationId || HOME_LOCATION_ID) === where);
  const [view, setView] = useState<View>("overview");
  const [pf, setPf] = useState<PerfFilters>({});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = window.setTimeout(() => {
      if (q.get("view") === "performance" || q.get("view") === "barbers") setView("performance");
      if (q.get("view") === "services") setView("services");
      if (q.get("loc")) setLoc(q.get("loc")!);
      if (q.get("r") === "week" || q.get("r") === "month" || q.get("r") === "today") setRange(q.get("r") as SalesRange);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const unpaid = rows.filter((row) => !row.paid && row.status !== "declined").reduce((sum, row) => sum + row.price, 0);
  const report = salesReport(rows, unpaid, range);
  const branches = useMemo(() => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]), [shops.enabled, shops.branches, profile.name]);
  const barbers = useMemo(() => { const off = new Set(chairs.filter((c) => c.active === false).map((c) => c.barberId || c.id)); return barberStats(all, range, where, branches, chairs).filter((b) => !off.has(b.id)); }, [all, range, where, branches, chairs]);
  const remit = useRemit(where);
  const roster = useMemo(() => chairs.filter((c) => c.active !== false).map((c) => { const l = c.locationId || HOME_LOCATION_ID; return { id: c.barberId || c.id, name: chairBarberName(c), locationId: l, locationName: branches.find((b) => b.id === l)?.name ?? "" }; }), [chairs, branches]);
  const claim = (id: string, l: string) => void remit.claim(id, l);
  const locName = (id: string) => (shops.enabled ? branches.find((b) => b.id === id)?.name ?? "" : "");

  if (!deep && !cloud.ready) return <DashboardSkeleton />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="border-b border-line px-1 pb-3">
        <div className="flex items-center gap-1">
          <PageBack fallback="/home" />
          <h1 className="flex items-center gap-1.5 text-[28px] font-extrabold leading-none tracking-[-0.03em]">
            <CoinIcon size={28} /> Sales
          </h1>
          <Link href="/sales/barbers" aria-label="My Barbers leaderboard" title="My Barbers" className="ml-auto inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink shadow-card"><Trophy size={19} strokeWidth={2} /></Link>
        </div>
      </header>

      <div role="tablist" aria-label="Sales view" className="mt-3 grid grid-cols-3 rounded-pill bg-grey-100 p-1">
        {VIEWS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={view === item.value} onClick={() => setView(item.value)}
            className={cn("h-9 rounded-pill text-[13.5px] font-bold transition", view === item.value ? "bg-surface text-ink shadow-card" : "text-muted")}>{item.label}</button>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {shops.enabled && shops.branches.length > 1 ? (
          <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-pill bg-surface px-3 shadow-card">
            <MapPin size={14} className="flex-none text-muted" aria-hidden />
            <select aria-label="Location" value={where} onChange={(e) => setLoc(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[12.5px] font-bold outline-none">
              <option value="all">All locations</option>
              {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        ) : null}
        <span className="inline-flex items-center gap-1"><RangeChips value={range} onChange={setRange} allowCustom />{view === "services" ? <PerfFilterButton value={pf} onChange={setPf} all={all} chairs={chairs} /> : null}</span>
      </div>

      {view === "overview" ? (
        <>
          <Overview report={report} />
          <BarberSalesRanking barbers={barbers} roster={roster} range={range} showLoc={shops.enabled && where === "all"} where={where} />
        </>
      ) : null}
      {view === "performance" ? (
        <>
          <StatCard className="mt-4 pb-3" label="Collected" value={peso(report.collected)} caption={<><PaySplitText split={report.collectedSplit} /><TipsLine tips={report.tips} /></>} />
          <UnclaimedCard className="mt-3" remit={remit.data} onClaim={claim} claiming={remit.busy} locName={locName} />
          {remit.error ? <p className="mt-2 text-[13px] font-semibold">{remit.error}</p> : null}
          <BarberRanking rows={barbers} range={range} showLoc={where === "all" && shops.enabled} remit={remit.data}
            onClaim={where !== "all" || !shops.enabled ? (id, l) => void remit.claim(id, l) : undefined} claiming={remit.busy} />
          <ClaimHistory remit={remit.data} locName={locName} />
        </>
      ) : null}
      {view === "services" ? (
        <>
          <PerformanceDashboard f={pf} all={all} range={range} where={where} branches={branches} chairs={chairs} />
        </>
      ) : null}
      <Button className="mt-6" variant="secondary" fullWidth href="/history">See each visit in History</Button>
    </div>
  );
}

/** "incl. ₱X tips" under a Collected figure; nothing when there are no tips. */
function TipsLine({ tips }: { tips: number }) {
  return tips > 0 ? <span className="mt-0.5 block text-[12px] font-semibold text-muted">incl. {peso(tips)} tips</span> : null;
}

function Overview({ report }: { report: ReturnType<typeof salesReport> }) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard className="col-span-2 pb-3" label="Sales" caption={report.delta} value={
          <span className="flex w-full items-baseline justify-between gap-3">
            <span className="text-[28px] leading-none tracking-[-0.03em]">{peso(report.sales)}</span>
            <span className="text-right text-[15px] font-extrabold tabular-nums">{report.cuts} <small className="text-[12px] font-semibold text-muted">cut{report.cuts === 1 ? "" : "s"}</small></span>
          </span>} />
        <StatCard className="pb-3" label="Collected" value={peso(report.collected)} caption={<><PaySplitText split={report.collectedSplit} layout="lines" /><TipsLine tips={report.tips} /></>} />
        <StatCard className="pb-3" label="Uncollected" value={peso(report.unpaid)} caption={report.unpaid > 0 ? "Still unpaid" : "Nothing owed"} />
      </div>
    </>
  );
}
