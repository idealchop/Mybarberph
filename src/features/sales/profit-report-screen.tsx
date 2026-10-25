"use client";

import { AppLoader } from "@/components/common/app-loader";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { profitWeek } from "@/lib/profit-report";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSalesRows } from "./use-sales-rows";

const cell = (n: number) => (n ? peso(n) : "-");
const FETCH_DAYS = 70;
const TABLE_W = 760;

/** Full weekly profit report, laid out like a shop spreadsheet: barbers down, days across. */
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

  if (!deep && !cloud.ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-3 pb-8 pt-3 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <div className="flex items-start gap-1">
        <PageBack fallback="/home" />
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-2">
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold leading-tight tracking-[-0.02em]">Weekly Profit Report</h1>
            <p className="mt-0.5 flex items-center gap-0.5 text-[12px] font-medium text-muted">
              <button type="button" aria-label="Previous week" onClick={() => setOffset((n) => Math.max(-8, n - 1))} className="inline-flex size-6 items-center justify-center rounded-full text-ink"><ChevronLeft size={14} /></button>
              <span className="truncate">{report.label}</span>
              <button type="button" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset((n) => Math.min(0, n + 1))} className="inline-flex size-6 items-center justify-center rounded-full text-ink disabled:opacity-30"><ChevronRight size={14} /></button>
            </p>
          </div>
          <div className="flex flex-none flex-col items-end gap-1.5">
            <div role="radiogroup" aria-label="Shop" className="flex gap-1">
              {filters.map((b) => (
                <button key={b.id} type="button" role="radio" aria-checked={where === b.id} onClick={() => setPicked(b.id)}
                  className={`h-6 rounded-[6px] px-2 text-[11px] font-bold ${where === b.id ? "bg-[#3d9b4a] text-white" : "bg-white text-[#3d9b4a] ring-1 ring-[#3d9b4a]"}`}>{b.name}</button>
              ))}
            </div>
            <Link href="/sales?view=barbers" className="inline-flex h-6 items-center rounded-[6px] px-2.5 text-[11px] font-bold text-[#3d9b4a] ring-1 ring-[#3d9b4a]">Claiming</Link>
          </div>
        </div>
      </div>

      <FitTable>
        <table className="w-full border-collapse bg-white text-[11px]">
          <thead>
            <tr className="bg-[#6d6d6d] text-[10.5px] font-semibold text-white">
              <th scope="col" className="sticky left-0 z-10 bg-[#6d6d6d] px-2 py-1.5 text-left font-semibold">Barber</th>
              {report.days.map((d) => (
                <th key={d.key} scope="col" className="px-1 py-1 text-center font-semibold leading-tight">
                  <span className="block">{d.dow}</span>
                  <span className="block text-[9px] font-medium">{d.date}</span>
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr><td colSpan={9} className="border border-[#ececec] px-2 py-6 text-center text-[12px] font-semibold text-muted">No finished cuts this week.</td></tr>
            ) : report.rows.map((row) => (
              <tr key={`${row.id}@${row.locationId}`}>
                <th scope="row" className="sticky left-0 z-10 border border-[#ececec] bg-white px-2 py-1 text-left font-medium">
                  <Link href={`/sales/detail?kind=barber&id=${encodeURIComponent(row.id)}&loc=${encodeURIComponent(row.locationId)}&r=week`} className="block max-w-[120px] truncate">{row.name}</Link>
                  {where === "all" && row.locationName ? <span className="block max-w-[120px] truncate text-[9px] font-medium text-muted">{row.locationName}</span> : null}
                </th>
                {row.days.map((n, i) => <td key={report.days[i]?.key ?? i} className="border border-[#ececec] px-1 py-1 text-center tabular-nums">{cell(n)}</td>)}
                <td className="border border-[#ececec] px-2 py-1 text-right font-bold tabular-nums">{peso(row.total)}</td>
              </tr>
            ))}
          </tbody>
          {report.rows.length ? (
            <tfoot>
              <tr className="font-bold">
                <th scope="row" className="sticky left-0 z-10 border border-[#ececec] bg-white px-2 py-1.5 text-left">Daily Totals</th>
                {report.daily.map((n, i) => <td key={report.days[i]?.key ?? i} className="border border-[#ececec] px-1 py-1.5 text-center tabular-nums">{cell(n)}</td>)}
                <td className="border border-[#ececec] px-1.5 py-1 text-right">
                  <span className="inline-flex rounded-[3px] bg-ink px-1.5 py-0.5 text-[11px] font-bold text-on-ink tabular-nums">{peso(report.total)}</span>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </FitTable>
    </div>
  );
}

/** Shrinks the spreadsheet so a phone shows every day, the way the printed report does. */
function FitTable({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / TABLE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className="mt-3 w-full overflow-hidden">
      <div style={{ width: TABLE_W, zoom: scale }}>{children}</div>
    </div>
  );
}
