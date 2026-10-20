"use client";
import { DashboardSkeleton } from "@/components/common/skeleton";
import { MapPin } from "lucide-react";
import { CoinIcon } from "@river-apps/icons";
import { StatCard, cn } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useEffect, useMemo, useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopProfile } from "@/lib/shop-profile";
import { useShopChairs } from "@/lib/shop-chairs";
import { rangeFetchDays, salesReport, type SalesRange } from "@/lib/sales-report";
import { barberStats, rankedBarbers } from "@/lib/sales-stats";
import { BarberRanking, ClaimHistory, PaySplitText, RangeChips, UnclaimedCard } from "./sales-parts";
import { useRemit } from "./use-remit";
import { useSalesRows } from "./use-sales-rows";
import { BarberLeaderboard } from "./barber-leaderboard";
import { PerfFilterButton, PerformanceDashboard, type PerfFilters } from "./performance-dashboard";

// Three tabs (Jimboy, 2026-10-20): Collection (default), Performance, My Barbers. Old ?view=overview links land on Collection.
type View = "performance" | "services" | "barbers";
const VIEWS: { value: View; label: string }[] = [
  { value: "performance", label: "Collection" },
  { value: "services", label: "Performance" },
  { value: "barbers", label: "My Barbers" },
];

/** Sales: Collection / Performance, filtered by location and a compact date chip. */
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
  const [view, setView] = useState<View>("performance");
  const [pf, setPf] = useState<PerfFilters>({});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = window.setTimeout(() => {
      // Anything but "services" (incl. the old overview tab) opens Collection.
      const v = q.get("view") ?? q.get("tab");
      setView(v === "services" ? "services" : v === "barbers" ? "barbers" : "performance");
      if (q.get("loc")) setLoc(q.get("loc")!);
      if (q.get("r") === "week" || q.get("r") === "month" || q.get("r") === "today") setRange(q.get("r") as SalesRange);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const unpaid = rows.filter((row) => !row.paid && row.status !== "declined").reduce((sum, row) => sum + row.price, 0);
  const report = salesReport(rows, unpaid, range);
  const branches = useMemo(() => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]), [shops.enabled, shops.branches, profile.name]);
  const barbers = useMemo(() => rankedBarbers(barberStats(all, range, where, branches, chairs), chairs), [all, range, where, branches, chairs]);
  const remit = useRemit(where);
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

      {view === "performance" ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard className="pb-3" label="Collected" value={peso(report.collected)} caption={<PaySplitText split={report.collectedSplit} layout="lines" />} />
            <StatCard className="pb-3" label="Uncollected" value={peso(report.unpaid)} caption={report.unpaid > 0 ? "Still unpaid" : "Nothing owed"} />
          </div>
          <UnclaimedCard className="mt-3" remit={remit.data} onClaim={claim} claiming={remit.busy} locName={locName} />
          {remit.error ? <p className="mt-2 text-[13px] font-semibold">{remit.error}</p> : null}
          <BarberRanking rows={barbers} range={range} chairs={chairs} remit={remit.data}
            onClaim={where !== "all" || !shops.enabled ? (id, l) => void remit.claim(id, l) : undefined} claiming={remit.busy} />
          <ClaimHistory remit={remit.data} locName={locName} />
        </>
      ) : null}
      {view === "services" ? (
        <>
          <PerformanceDashboard f={pf} all={all} range={range} where={where} branches={branches} chairs={chairs} />
        </>
      ) : null}
      {view === "barbers" ? <BarberLeaderboard range={range} where={where} all={all} /> : null}
      <Button className="mt-6" variant="secondary" fullWidth href="/history">See each visit in History</Button>
    </div>
  );
}

