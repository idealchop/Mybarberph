"use client";

import { AppLoader } from "@/components/common/app-loader";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { profitWeek } from "@/lib/profit-report";
import { cn } from "@river-apps/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSalesRows } from "./use-sales-rows";

const FETCH_DAYS = 70;
const todayKey = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

const pinL = "sticky left-0 z-10";
const pinR = "sticky right-0 z-10";

/** Full weekly profit report: barbers down the side, finished-cut sales across the week. */
export function ProfitReportScreen() {
  const shops = useShopLocations();
  const { profile } = useShopProfile();
  const { chairs } = useShopChairs({ all: true });
  const deep = useSalesRows(FETCH_DAYS);
  const cloud = useChairRequests();
  const rows = deep ?? cloud.rows;
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState("");
  const branches = useMemo(
    () => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]),
    [shops.enabled, shops.branches, profile.name],
  );
  const where = picked || (shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const report = profitWeek(rows, chairs, where, offset, Date.now(), branches);
  const filters = [{ id: "all", name: "All" }, ...(shops.enabled && branches.length > 1 ? branches : [])];
  const today = todayKey();
  const showYear = new Set(report.days.map((d) => d.date.slice(-4))).size > 1;

  if (!deep && !cloud.ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-2 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-0.5">
        <PageBack fallback="/home" />
        <h1 className="min-w-0 text-[22px] font-extrabold leading-tight tracking-[-0.03em]">Weekly Profit Report</h1>
      </div>

      <div className="mt-1 flex items-center gap-1">
        <button type="button" aria-label="Previous week" onClick={() => setOffset((n) => Math.max(-8, n - 1))} className="inline-flex size-9 flex-none items-center justify-center rounded-full text-ink">
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-0 truncate text-[13.5px] font-semibold">{report.label}</p>
        <button type="button" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset((n) => Math.min(0, n + 1))} className="inline-flex size-9 flex-none items-center justify-center rounded-full text-ink disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
        <span className="min-w-2 flex-1" />
        <Link href="/sales?view=barbers" className="inline-flex h-8 flex-none items-center rounded-pill bg-surface px-3 text-[12.5px] font-bold text-ink ring-1 ring-line">Claiming</Link>
      </div>

      <section aria-label="Week sales" className="mt-3 rounded-banner bg-ink px-4 py-4 text-on-ink">
        <p className="text-[12.5px] font-semibold text-on-ink-muted">Week sales</p>
        <b className="mt-0.5 block text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(report.total)}</b>
        <p className="mt-2 text-[12.5px] font-semibold text-on-ink-muted">{report.rows.length === 0 ? "No finished cuts" : `${report.rows.length} barber${report.rows.length === 1 ? "" : "s"}`}</p>
      </section>

      {filters.length > 1 ? (
        <div role="radiogroup" aria-label="Shop" className="mt-3 flex gap-1 overflow-x-auto">
          {filters.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={where === b.id} onClick={() => setPicked(b.id)}
              className={cn("h-8 max-w-[148px] flex-none truncate rounded-pill px-3 text-[12.5px] font-bold", where === b.id ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{b.name}</button>
          ))}
        </div>
      ) : null}

      {report.rows.length === 0 ? null : (
        <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[12.5px] lg:min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-bold text-on-ink">
                  <th scope="col" className={cn(pinL, "bg-ink px-3 py-2.5")}>Barber</th>
                  {report.days.map((d) => {
                    const isToday = d.key === today;
                    return (
                      <th key={d.key} scope="col" className={cn("min-w-[4.75rem] bg-ink px-2 py-2 text-center font-bold", isToday && "text-white")}>
                        <span className="block text-[12px]">{d.dow}</span>
                        <span className={cn("mt-0.5 block text-[10px] font-semibold", isToday ? "text-white" : "text-on-ink-muted")}>
                          {isToday ? "Today" : showYear ? d.date : d.date.slice(0, 5)}
                        </span>
                      </th>
                    );
                  })}
                  <th scope="col" className={cn(pinR, "bg-ink px-3 py-2.5 text-right")}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={`${row.id}@${row.locationId}`} className="group">
                    <th scope="row" className={cn(pinL, "border-b border-line bg-surface px-3 py-2.5 text-left shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]")}>
                      <Link href={`/sales/detail?kind=barber&id=${encodeURIComponent(row.id)}&loc=${encodeURIComponent(row.locationId)}&r=week`} className="block max-w-[9.5rem] truncate font-semibold">{row.name}</Link>
                      {where === "all" && row.locationName ? <span className="mt-0.5 block max-w-[9.5rem] truncate text-[11px] font-medium text-muted">{row.locationName}</span> : null}
                    </th>
                    {row.days.map((n, i) => {
                      const day = report.days[i];
                      const isToday = day?.key === today;
                      return (
                        <td key={day?.key ?? i} className={cn("whitespace-nowrap border-b border-line px-2 py-2.5 text-center tabular-nums", isToday && "bg-grey-100")}>
                          {n ? <span className="font-semibold">{peso(n)}</span> : <span className="text-muted">–</span>}
                        </td>
                      );
                    })}
                    <td className={cn(pinR, "border-b border-line bg-surface px-3 py-2.5 text-right font-bold tabular-nums shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.35)]")}>{peso(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <th scope="row" className={cn(pinL, "bg-grey-100 px-3 py-3 text-left")}>Daily totals</th>
                  {report.daily.map((n, i) => {
                    const day = report.days[i];
                    return (
                      <td key={day?.key ?? i} className="bg-grey-100 px-2 py-3 text-center tabular-nums">
                        {n ? peso(n) : <span className="font-semibold text-muted">–</span>}
                      </td>
                    );
                  })}
                  <td className={cn(pinR, "bg-grey-100 px-3 py-2.5 text-right")}>
                    <span className="inline-flex rounded-pill bg-ink px-2.5 py-1 text-[12.5px] font-bold text-on-ink tabular-nums">{peso(report.total)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
