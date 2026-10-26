"use client";
import { useSearchParams } from "next/navigation";
import { useNow } from "@/lib/use-now";
import { AppLoader } from "@/components/common/app-loader";
import { MapPin } from "lucide-react";
import { CoinIcon } from "@river-apps/icons";
import { cn } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useEffect, useMemo, useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopProfile } from "@/lib/shop-profile";
import { useShopChairs } from "@/lib/shop-chairs";
import { DAY_RANGES, getCustomRange, rangeFetchDays, type SalesRange } from "@/lib/sales-report";
import { periodBounds, periodDays } from "@/lib/barber-sales";
import { DaySales } from "./day-sales";
import { barberStats, inRange, rankedBarbers } from "@/lib/sales-stats";
import { SalesGroups } from "./sales-groups";
import { showsLocationFilter } from "@/lib/sales-filters";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { BarberIcon } from "@/components/art";
import { ownerShareOf, sharePct } from "@/lib/income-split";
import { OWNER_BARBER_ID } from "@/lib/owner-cut";
import { BarberRanking, ClaimHistory, RangeChips, UnclaimedCard } from "./sales-parts";
import { useRemit } from "./use-remit";
import { useSalesRows } from "./use-sales-rows";
import { BarberLeaderboard } from "./barber-leaderboard";
import { PerfFilterButton, PerformanceDashboard, type PerfFilters } from "./performance-dashboard";

// Three tabs (Jimboy, 2026-10-20): Collection (default), Performance, My Barbers. Old ?view=overview links land on Collection.
// Batch 17 (Jimboy, 2026-10-21): My Barbers moves back to the top-right; the third tab is Sales group.
type View = "performance" | "services" | "groups" | "barbers";
const VIEWS: { value: View; label: string }[] = [
  { value: "performance", label: "Collection" },
  { value: "services", label: "Performance" },
  { value: "groups", label: "Sales group" },
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
  // Re-read on every URL change too (e.g. Weekly Profit Report → Claiming while Sales is already mounted).
  const search = useSearchParams().toString();
  useEffect(() => {
    const q = new URLSearchParams(search);
    const t = window.setTimeout(() => {
      // Anything but "services" (incl. the old overview tab) opens Collection.
      const v = q.get("view") ?? q.get("tab");
      setView(v === "services" ? "services" : v === "barbers" ? "barbers" : v === "groups" ? "groups" : "performance");
      if (q.get("loc")) setLoc(q.get("loc")!);
      const r = q.get("r");
      if (r === "week" || r === "month" || r === "today" || r === "d30" || r === "all" || r === "custom") setRange(r);
    }, 0);
    return () => window.clearTimeout(t);
  }, [search]);

  // Each visit's barber split % (owner's own cuts are all the shop's).
  const pctOf = (r: { barberId?: string; seatLabel?: string; chairLabel?: string; locationId?: string }) => {
    if (r.barberId === OWNER_BARBER_ID) return 0;
    const bl = r.locationId || HOME_LOCATION_ID;
    const c = chairs.find((x) => (r.barberId && (x.barberId === r.barberId || x.id === r.barberId)) || (!r.barberId && x.label === (r.seatLabel || r.chairLabel) && (x.locationId || HOME_LOCATION_ID) === bl));
    return c ? sharePct(c) : null;
  };
  const now = useNow();
  const bounds = periodBounds(range, now, range === "custom" ? getCustomRange() : null);
  const todayKey = periodDays("today")[0] ?? "";
  const commissionDays = periodDays(range, now, range === "custom" ? getCustomRange() : null).map((date) => ({ date, amount: 0, cuts: 0 }));
  const byDay = new Map(commissionDays.map((d) => [d.date, d]));
  for (const r of rows) {
    if (r.status !== "done" || !r.completedAt || r.completedAt < bounds.from || r.completedAt >= bounds.to) continue;
    const day = byDay.get(periodDays("today", r.completedAt)[0] ?? "");
    if (!day) continue;
    day.cuts += 1;
    day.amount += ownerShareOf(r.price || 0, pctOf(r));
  }
  const commission = commissionDays.reduce((s, d) => s + d.amount, 0);
  const branches = useMemo(() => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]), [shops.enabled, shops.branches, profile.name]);
  const barbers = useMemo(() => rankedBarbers(barberStats(all, range, where, branches, chairs), chairs), [all, range, where, branches, chairs]);
  const remit = useRemit(where);
  const claim = (id: string, l: string) => void remit.claim(id, l);
  const locName = (id: string) => (shops.enabled ? branches.find((b) => b.id === id)?.name ?? "" : "");

  if (!deep && !cloud.ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="border-b border-line px-1 pb-3">
        <div className="flex items-center gap-1">
          <PageBack fallback="/home" />
          <h1 className="flex items-center gap-1.5 text-[28px] font-extrabold leading-none tracking-[-0.03em]">
            <CoinIcon size={28} /> Sales
          </h1>
          <button type="button" aria-pressed={view === "barbers"} onClick={() => setView(view === "barbers" ? "performance" : "barbers")}
            className={`ml-auto inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 ${view === "barbers" ? "border-ink bg-ink text-on-ink" : "border-line"}`}>
            <BarberIcon name="trophy" size={28} />
            <span className="text-[13px] font-bold leading-none">My Barbers</span>
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Sales view" className="mt-3 grid grid-cols-3 rounded-pill bg-grey-100 p-1">
        {VIEWS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={view === item.value} onClick={() => setView(item.value)}
            className={cn("h-9 rounded-pill text-[13.5px] font-bold transition", view === item.value ? "bg-surface text-ink shadow-card" : "text-muted")}>{item.label}</button>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {showsLocationFilter(view) && shops.enabled && shops.branches.length > 1 ? (
          <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-pill bg-surface px-3 shadow-card">
            <MapPin size={14} className="flex-none text-muted" aria-hidden />
            <LocationSwitcher className="flex-1 text-[12.5px] font-bold" value={where} allId="all" onChange={setLoc}
              label={where === "all" ? "All locations" : shops.branches.find((b) => b.id === where)?.name ?? "Main"}
              options={shops.branches.map((b) => ({ id: b.id, name: b.name, sub: b.area || b.address }))} />
          </div>
        ) : null}
        <span className="inline-flex items-center gap-1"><RangeChips value={range} onChange={setRange} ranges={DAY_RANGES} allowCustom />{view === "services" ? <PerfFilterButton value={pf} onChange={setPf} all={all} chairs={chairs} /> : null}</span>
      </div>

      {view === "performance" ? (
        <DaySales eyebrow="Your commission" total={commission} days={commissionDays} today={todayKey} empty="No finished cuts in this range." />
      ) : null}
      {view === "services" ? (
        <>
          <PerformanceDashboard f={pf} all={all} range={range} where={where} branches={branches} chairs={chairs} />
        </>
      ) : null}
      {view === "barbers" ? (
        <>
          <UnclaimedCard className="mt-4" remit={remit.data} onClaim={claim} claiming={remit.busy} locName={locName} />
          {remit.error ? <p className="mt-2 text-[13px] font-semibold">{remit.error}</p> : null}
          <BarberRanking rows={barbers} range={range} chairs={chairs} remit={remit.data}
            onClaim={where !== "all" || !shops.enabled ? (id, l) => void remit.claim(id, l) : undefined} claiming={remit.busy} />
          <ClaimHistory remit={remit.data} locName={locName} />
          <BarberLeaderboard range={range} where={where} all={all} />
        </>
      ) : null}
      {view === "groups" ? <SalesGroups rows={inRange(all, range, "all")} chairs={chairs} branches={branches} /> : null}
      <Button className="mt-6" variant="secondary" fullWidth href="/history">See each visit in History</Button>
    </div>
  );
}

