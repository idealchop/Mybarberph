"use client";
import { ChevronRight, MapPin } from "lucide-react";
import { CoinIcon } from "@river-apps/icons";
import { Card, StatCard, cn } from "@river-apps/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageBack } from "@/components/shell/PageBack";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopProfile } from "@/lib/shop-profile";
import { useShopChairs } from "@/lib/shop-chairs";
import { SALES_RANGES, salesReport, type SalesRange } from "@/lib/sales-report";
import { barberStats, locationStats, serviceStats } from "@/lib/sales-stats";
import { SalesChartCard } from "./SalesChart";
import { BarberRanking, LocationCards, RangeChips, ServiceTable } from "./SalesParts";
import { useSalesRows } from "./useSalesRows";

type View = "overview" | "performance" | "services";
const VIEWS: { value: View; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "performance", label: "Barbers" },
  { value: "services", label: "Services" },
];

/** Sales: Overview / Barbers / Services, filtered by location and a compact date chip. */
export function SalesDataScreen() {
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const { chairs } = useShopChairs({ all: true });
  const cloud = useChairRequests();
  const deep = useSalesRows();
  const all = deep ?? cloud.rows;
  const [loc, setLoc] = useState("");
  const where = loc || (shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const rows = all.filter((r) => where === "all" || (r.locationId || HOME_LOCATION_ID) === where);
  const [range, setRange] = useState<SalesRange>("today");
  const [view, setView] = useState<View>("overview");
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
  const locs = useMemo(() => locationStats(all, range, branches), [all, range, branches]);
  const barbers = useMemo(() => barberStats(all, range, where, branches, chairs), [all, range, where, branches, chairs]);
  const services = useMemo(() => serviceStats(all, range, where), [all, range, where]);
  const serviceByLoc = where === "all" && shops.enabled
    ? branches.map((b) => ({ loc: b.name, rows: serviceStats(all, range, b.id) }))
    : undefined;
  const branchName = shops.branches.find((b) => b.id === where)?.name;
  const place = where === "all" ? (shops.enabled ? "All locations" : profile.name) : `${profile.name} · ${branchName ?? ""}`;

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="border-b border-line px-1 pb-3">
        <div className="flex items-center gap-1">
          <PageBack fallback="/home" />
          <h1 className="flex items-center gap-1.5 text-[28px] font-extrabold leading-none tracking-[-0.03em]">
            <CoinIcon size={28} /> Sales
          </h1>
        </div>
        <p className="mt-0.5 pl-[4.75rem] text-[14px] font-semibold text-muted">{SALES_RANGES.find((i) => i.value === range)?.label} · {place}</p>
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
        <RangeChips value={range} onChange={setRange} />
      </div>

      {view === "overview" ? (
        <>
          <Overview report={report} rows={all} />
          {where === "all" && shops.enabled && shops.branches.length > 1 ? <LocationCards rows={locs} range={range} /> : null}
        </>
      ) : null}
      {view === "performance" ? <BarberRanking rows={barbers} range={range} showLoc={where === "all" && shops.enabled} /> : null}
      {view === "services" ? <ServiceTable rows={services} split={serviceByLoc} /> : null}
    </div>
  );
}

function Overview({ report, rows }: { report: ReturnType<typeof salesReport>; rows: ReturnType<typeof useChairRequests>["rows"] }) {
  const [open, setOpen] = useState<string | null>(null);
  const openRow = open ? rows.find((r) => r.id === open) : undefined;
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard className="col-span-2 pb-3 lg:col-span-1" label="Sales" value={<span className="text-[28px] leading-none tracking-[-0.03em]">{peso(report.sales)}</span>} caption={report.delta} />
        <StatCard className="pb-3" label="Cuts" value={String(report.cuts)} caption={`${report.customers} customers`} />
        <StatCard className="pb-3" label="Collected" value={peso(report.collected)} caption={report.unpaid > 0 ? `${peso(report.unpaid)} unpaid` : "All collected"} />
        <StatCard className="col-span-2 pb-3 lg:col-span-1" label="Avg ticket" value={peso(report.average)} caption="Per cut" />
      </div>
      <SalesChartCard className="mt-3" series={report.series} kind={report.seriesKind} sales={report.sales} />
      {report.recent.length ? (
        <Card padding="none" className="mt-3 px-4 py-3">
          <h2 className="px-0.5 pt-1 text-[16px] font-bold">Latest cuts</h2>
          {openRow ? <TransactionSheet row={openRow} onClose={() => setOpen(null)} /> : null}
          <ul>
            {report.recent.map((item) => (
              <li key={item.id} role="button" tabIndex={0} aria-label={`Open ${item.who}`} onClick={() => setOpen(item.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(item.id); }} className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span aria-hidden className="flex size-9 flex-none items-center justify-center rounded-full bg-grey-100 text-[13px] font-extrabold">{(item.who.trim()[0] || "#").toUpperCase()}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{item.who}</b><small className="text-[12.5px] font-semibold text-muted">{item.when ? `${item.service} · ${item.when}` : item.service}</small></span>
                <b className="text-[14px] tabular-nums">{peso(item.sales)}</b>
                <ChevronRight size={18} className="flex-none text-subtle" aria-hidden />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Link href="/history" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]">See each visit in History</Link>
    </>
  );
}
