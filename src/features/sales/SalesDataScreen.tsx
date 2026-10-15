"use client";
import { ChevronRight, MapPin } from "lucide-react";

import { CoinIcon } from "@river-apps/icons";
import { Card, EmptyState, SegmentedControl, StatCard, cn } from "@river-apps/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageBack } from "@/components/shell/PageBack";
import { peso } from "@/lib/format";
import { useChairRequests } from "@/lib/chair-bookings";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopProfile } from "@/lib/shop-profile";
import { SALES_RANGES, salesReport, type SalesRange, type SalesRow, type SalesView } from "@/lib/sales-report";
import { SalesChartCard } from "./SalesChart";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { BarberSalesView } from "./BarberSalesView";

type View = SalesView | "performance";
const VIEWS: { value: View; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "performance", label: "Barbers" },
  { value: "services", label: "Services" },
];

/** Sales for the shop: money, cuts, how it was paid, and who did the work. */
export function SalesDataScreen() {
  const { profile } = useShopProfile();
  const shops = useShopLocations();
  const { rows: all, ready } = useChairRequests();
  const [loc, setLoc] = useState<string>("");
  const where = loc || (shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const rows = ready ? all.filter((r) => where === "all" || (r.locationId || HOME_LOCATION_ID) === where) : [];
  const [range, setRange] = useState<SalesRange>("today");
  const [view, setView] = useState<View>("overview");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = window.setTimeout(() => { if (q.get("view") === "performance") setView("performance"); if (q.get("loc")) setLoc(q.get("loc")!); }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const unpaid = rows.filter((row) => !row.paid && row.status !== "declined").reduce((sum, row) => sum + row.price, 0);
  const report = salesReport(rows, unpaid, range);
  const branchName = shops.branches.find((b) => b.id === where)?.name;
  const place = where === "all" ? (shops.enabled ? "All locations" : profile.name) : `${profile.name} · ${branchName ?? ""}`;

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="flex flex-wrap items-end gap-x-6 border-b border-line px-1">
        <div className="min-w-0 pb-3">
          <div className="flex items-center gap-1">
            <PageBack fallback="/home" />
            <h1 className="flex items-center gap-1.5 text-[28px] font-extrabold leading-none tracking-[-0.03em]">
              <CoinIcon size={28} />
              Sales
            </h1>
          </div>
          <p className="mt-0.5 pl-[4.75rem] text-[14px] font-semibold text-muted">{view === "performance" ? "Barbers" : SALES_RANGES.find((item) => item.value === range)?.label} · {place}</p>
        </div>
      </header>
      <div role="tablist" aria-label="Sales view" className="mt-3 grid grid-cols-3 rounded-pill bg-grey-100 p-1">
        {VIEWS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={view === item.value} onClick={() => setView(item.value)}
            className={cn("h-9 rounded-pill text-[13.5px] font-bold transition", view === item.value ? "bg-surface text-ink shadow-card" : "text-muted")}>{item.label}</button>
        ))}
      </div>
      {shops.enabled && shops.branches.length > 1 ? (
        <label className="mt-2.5 flex h-10 items-center gap-2 rounded-pill bg-surface px-3.5 shadow-card">
          <MapPin size={15} className="flex-none text-muted" aria-hidden />
          <select aria-label="Location" value={where} onChange={(e) => setLoc(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] font-bold outline-none">
            <option value="all">All locations</option>
            {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      ) : null}

      {view === "performance" ? <div className="mt-4"><BarberSalesView loc={where} ranked={where === "all" && shops.enabled} /></div> : (
      <SegmentedControl
        className="mt-4 w-fit"
        label="Date range"
        value={range}
        onChange={setRange}
        options={SALES_RANGES.map(({ value, label }) => ({ value, label }))}
      />
      )}

      {view === "overview" ? <Overview report={report} range={range} /> : null}
      {view === "services" ? <Breakdown title="Services" empty="No cuts in this shop yet." rows={report.services} total={report.services.reduce((sum, item) => sum + item.salesCentavos, 0)} /> : null}
    </div>
  );
}

function Overview({ report, range }: { report: ReturnType<typeof salesReport>; range: SalesRange }) {
  const { rows } = useChairRequests();
  const [open, setOpen] = useState<string | null>(null);
  const openRow = open ? rows.find((r) => r.id === open) : undefined;
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          className="col-span-2 pb-3 lg:col-span-1"
          label="Sales"
          value={<span className="text-[28px] leading-none tracking-[-0.03em]">{peso(report.sales)}</span>}
          caption={report.delta}
        />
        <StatCard className="pb-3" label="Cuts" value={String(report.cuts)} caption={range === "today" ? `${report.customers} customers` : "Finished today"} />
        <StatCard className="pb-3" label="Collected" value={peso(report.collected)} caption={report.unpaid > 0 ? `${peso(report.unpaid)} still unpaid` : "All collected"} />
        <StatCard className="col-span-2 pb-3 lg:col-span-1" label="Average" value={peso(report.average)} caption="Per cut today" />
      </div>

      <SalesChartCard className="mt-3" series={report.series} kind={report.seriesKind} sales={report.sales} />

      {report.recent.length ? (
        <Card padding="none" className="mt-3 px-4 py-3">
          <h2 className="px-0.5 pt-1 text-[16px] font-bold">Latest cuts</h2>
          {openRow ? <TransactionSheet row={openRow} onClose={() => setOpen(null)} /> : null}
          <ul>
            {report.recent.map((item) => (
              <li key={item.id} role="button" tabIndex={0} aria-label={`View details for ${item.who}`} onClick={() => setOpen(item.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(item.id); }} className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span aria-hidden className="flex size-9 flex-none items-center justify-center rounded-full bg-grey-100 text-[13px] font-extrabold">
                  {mark(item.who)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px]">{item.who}</b>
                  <small className="text-[12.5px] font-semibold text-muted">{item.when ? `${item.service} · ${item.when}` : item.service}</small>
                </span>
                <span className="flex flex-col items-end">
                  <b className="text-[14px] tabular-nums">{peso(item.sales)}</b>
                  {item.paid ? null : <span className="text-[11.5px] font-bold text-muted">Unpaid</span>}
                </span>
                <ChevronRight size={18} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Link href="/history" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]">
        See each visit in History
      </Link>
    </>
  );
}

function ShopView({ report }: { report: ReturnType<typeof salesReport> }) {
  const channelTotal = report.channels.reduce((sum, item) => sum + item.orders, 0);
  return (
    <div className="mt-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
      <Card padding="none" className="px-4 py-3">
        <h2 className="px-0.5 pt-1 text-[16px] font-bold">Walk-in and online</h2>
        {report.channels.length === 0 ? (
          <p className="px-0.5 py-3 text-[13.5px] font-semibold text-muted">No cuts in this shop yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 pb-1">
            {report.channels.map((item, index) => {
              const share = channelTotal > 0 ? Math.round((item.orders / channelTotal) * 100) : 0;
              return (
                <div key={item.label} className="rounded-[12px] bg-grey-50 px-3 py-3">
                  <p className="text-[12px] font-semibold text-muted">{item.label}</p>
                  <p className="mt-0.5 text-[24px] font-extrabold leading-none tracking-[-0.03em]">{item.orders}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-grey-200">
                    <div className={cn("h-full rounded-full", index === 0 ? "bg-ink" : "bg-grey-400")} style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-1.5 text-[12px] font-semibold text-muted">{share}% of cuts</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Breakdown className="mt-0" title="Barbers" empty="No barber totals for this shop yet." rows={report.barbers} total={report.barbers.reduce((sum, item) => sum + item.salesCentavos, 0)} />
      <Breakdown className="mt-0 lg:col-span-2" title="Chairs" empty="No chair totals for this shop yet." rows={report.chairs} total={report.chairs.reduce((sum, item) => sum + item.salesCentavos, 0)} />
    </div>
  );
}

function Breakdown({ title, empty, rows, total, by = "sales", note, mix = false, className }: {
  title: string;
  empty: string;
  rows: SalesRow[];
  total: number;
  by?: "sales" | "orders";
  note?: string;
  mix?: boolean;
  className?: string;
}) {
  return (
    <Card padding="none" className={cn("mt-4 px-4 py-3", className)}>
      <h2 className="px-0.5 pt-1 text-[16px] font-bold">{title}</h2>
      {note ? <p className="px-0.5 text-[12.5px] font-semibold text-muted">{note}</p> : null}
      {rows.length === 0 ? <EmptyState className="my-2" title={empty} /> : (
        <>
          {mix ? <MixBar rows={rows} total={total} /> : null}
          <MeterList rows={rows} total={total} by={by} />
        </>
      )}
    </Card>
  );
}

function MixBar({ rows, total }: { rows: SalesRow[]; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-grey-100" aria-hidden>
      {rows.map((item, index) => {
        const share = (item.salesCentavos / total) * 100;
        if (share <= 0) return null;
        return <div key={item.label} className={cn("h-full", BAR[index % BAR.length])} style={{ width: `${share}%` }} />;
      })}
    </div>
  );
}

const BAR = ["bg-ink", "bg-grey-600", "bg-grey-500", "bg-grey-400", "bg-grey-300"];

function MeterList({ rows, total, by = "sales", className }: {
  rows: SalesRow[];
  total: number;
  by?: "sales" | "orders";
  className?: string;
}) {
  return (
    <ul className={cn("mt-1", className)}>
      {rows.map((item, index) => {
        const amount = by === "orders" ? item.orders : item.salesCentavos;
        const peak = Math.max(1, ...rows.map((row) => (by === "orders" ? row.orders : row.salesCentavos)));
        const share = total > 0 ? Math.round((amount / total) * 100) : 0;
        const width = Math.round((amount / peak) * 100);
        const lead = index === 0 && amount > 0;
        return (
          <li key={item.label} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
            <span aria-hidden className={cn("flex size-7 flex-none items-center justify-center rounded-full text-[12px] font-extrabold", lead ? "bg-ink text-white" : "bg-grey-100 text-grey-500")}>
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] font-bold">{item.label}</span>
                <span className="flex-none text-[14px] font-extrabold tabular-nums">{by === "orders" ? item.orders : item.salesCentavos ? peso(item.salesCentavos) : "—"}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-grey-100" aria-hidden>
                <div className={cn("h-full rounded-full", lead ? "bg-ink" : "bg-grey-300")} style={{ width: `${Math.max(width > 0 ? 6 : 0, Math.min(100, width))}%` }} />
              </div>
              <p className="mt-1 text-[12px] font-semibold text-muted">{item.detail === "Shop total" ? `${share}% of sales` : `${item.detail}${total > 0 ? ` · ${share}%` : ""}`}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function mark(name: string) {
  const trimmed = name.trim();
  if (!trimmed || /^\d/.test(trimmed)) return "#";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

