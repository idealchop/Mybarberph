"use client";

import { useNow } from "@/lib/use-now";
import { AppLoader } from "@/components/common/app-loader";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { compactPeso, groupProfitRows, profitWeek, type ProfitRow } from "@/lib/profit-report";
import { useCloud } from "@/lib/cloud";
import { normalizeGroups, SALES_GROUPS_KEY } from "@/lib/sales-groups";
import { cn } from "@river-apps/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useSalesRows } from "./use-sales-rows";

const FETCH_DAYS = 70;
const VIEW_KEY = "barbers.profit-report-view";
/** Same names and order as the Sales tabs' grouping: plain list, or the owner's saved Sales groups. */
const VIEWS = [{ value: "list", label: "List" }, { value: "groups", label: "Sales group" }] as const;
type View = (typeof VIEWS)[number]["value"];
const todayKey = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/** The barber's profile (Sales detail), for the week or focused on one Manila day, at that row's branch. */
const barberHref = (row: { id: string; locationId: string }, day?: string) =>
  `/sales/detail?kind=barber&id=${encodeURIComponent(row.id)}&loc=${encodeURIComponent(row.locationId)}${day ? `&day=${day}` : "&r=week"}`;

/** One grid cell: short amount on phones, full peso on desktop; future days are a faint dash. */
function Amount({ n, future, bold }: { n: number; future: boolean; bold?: boolean }) {
  if (future) return <span className="text-muted opacity-40">–</span>;
  if (!n) return <span className="font-semibold text-muted">–</span>;
  return (
    <span className={bold ? "font-bold" : "font-semibold"}>
      <span className="lg:hidden">{compactPeso(n)}</span>
      <span className="hidden lg:inline">{peso(n)}</span>
    </span>
  );
}

/** Full weekly profit report: barbers down the side, finished-cut sales across the week. */
export function ProfitReportScreen() {
  const shops = useShopLocations();
  const { profile } = useShopProfile();
  const { chairs } = useShopChairs({ all: true });
  const deep = useSalesRows(FETCH_DAYS);
  const cloud = useChairRequests();
  const rows = deep ?? cloud.rows;
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState("");
  const [view, setViewState] = useState<View>(() => { try { return typeof window !== "undefined" && localStorage.getItem(VIEW_KEY) === "groups" ? "groups" : "list"; } catch { return "list"; } });
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };
  const cloudValues = useCloud().values;
  const salesGroups = useMemo(() => { try { return normalizeGroups(JSON.parse(cloudValues[SALES_GROUPS_KEY] || "null")); } catch { return normalizeGroups(null); } }, [cloudValues]);
  const branches = useMemo(
    () => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]),
    [shops.enabled, shops.branches, profile.name],
  );
  const where = picked || (shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const report = profitWeek(rows, chairs, where, offset, now, branches);
  const filters = [{ id: "all", name: "All" }, ...(shops.enabled && branches.length > 1 ? branches : [])];
  const today = todayKey();
  const canGroup = where === "all" && filters.length > 1;
  const grouped = canGroup && view === "groups" ? groupProfitRows(report.rows, salesGroups) : null;
  const showYear = new Set(report.days.map((d) => d.date.slice(-4))).size > 1;

  const renderRow = (row: ProfitRow) => (
                <tr key={`${row.id}@${row.locationId}`}>
                  <th scope="row" className="border-b border-line py-2.5 pl-2.5 pr-1 text-left lg:px-3">
                    <Link href={barberHref(row)} className="block truncate font-semibold underline decoration-line decoration-dotted underline-offset-2">{row.name}</Link>
                    {where === "all" && row.locationName ? <span className="mt-0.5 block truncate text-[10px] font-medium text-muted lg:text-[11px]">{row.locationName}</span> : null}
                  </th>
                  {row.days.map((n, i) => {
                    const day = report.days[i];
                    const isToday = day?.key === today;
                    const future = !!day && day.key > today;
                    return (
                      <td key={day?.key ?? i} className={cn("whitespace-nowrap border-b border-line p-0 text-center tabular-nums", isToday && "bg-grey-100")}>
                        {n && !future && day ? (
                          <Link href={barberHref(row, day.key)} aria-label={`${row.name}, ${day.dow} ${day.date.slice(0, 5)}: ${peso(n)}. Open profile for that day`}
                            className="flex min-h-11 items-center justify-center py-1 active:bg-grey-200">
                            <span className="border-b border-dotted border-muted/70 leading-tight"><Amount n={n} future={false} /></span>
                          </Link>
                        ) : (
                          <span className="flex min-h-11 items-center justify-center"><Amount n={n} future={future} /></span>
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap border-b border-line py-2.5 pl-1 pr-2.5 text-right font-bold tabular-nums lg:px-3">
                    <span className="lg:hidden">{compactPeso(row.total)}</span><span className="hidden lg:inline">{peso(row.total)}</span>
                  </td>
                </tr>
  );

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
        <p className="min-w-0 whitespace-nowrap text-[13.5px] font-semibold tabular-nums">{report.label}</p>
        <button type="button" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset((n) => Math.min(0, n + 1))} className="inline-flex size-9 flex-none items-center justify-center rounded-full text-ink disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
        <span className="min-w-2 flex-1" />
        <Link href="/sales?view=barbers" className="inline-flex h-8 flex-none items-center rounded-pill bg-surface px-3 text-[12.5px] font-bold text-ink ring-1 ring-line">Claiming</Link>
      </div>

      <section aria-label="Your profit" className="mt-3 rounded-banner bg-ink px-4 py-4 text-on-ink">
        <p className="text-[12.5px] font-semibold text-on-ink-muted">Your profit</p>
        <b className="mt-0.5 block text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(report.total)}</b>
        <p className="mt-2 text-[12.5px] font-semibold text-on-ink-muted">{report.rows.length === 0 ? "No finished cuts" : `After barber commissions · ${report.rows.length} barber${report.rows.length === 1 ? "" : "s"}`}</p>
      </section>

      {filters.length > 1 ? (
        <div role="radiogroup" aria-label="Shop" className="mt-3 flex gap-1 overflow-x-auto">
          {filters.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={where === b.id} onClick={() => setPicked(b.id)}
              className={cn("h-8 max-w-[148px] flex-none truncate rounded-pill px-3 text-[12.5px] font-bold", where === b.id ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{b.name}</button>
          ))}
        </div>
      ) : null}

      {canGroup ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[12.5px] font-semibold text-muted">{grouped ? "Grouped like Sales → Sales group" : "Every barber"}</p>
          <div role="radiogroup" aria-label="Group rows" className="flex flex-none rounded-pill bg-grey-100 p-0.5">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" role="radio" aria-checked={view === v.value} onClick={() => setView(v.value)}
                className={cn("h-8 rounded-pill px-4 text-[13px] font-bold", view === v.value ? "bg-surface text-ink shadow-card" : "text-muted")}>{v.label}</button>
            ))}
          </div>
        </div>
      ) : null}

      {report.rows.length === 0 ? null : (
        <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[11.5px] lg:text-[12.5px]">
            <colgroup>
              <col className="w-[4.6rem] lg:w-[11rem]" />
              {report.days.map((d) => <col key={d.key} />)}
              <col className="w-[2.9rem] lg:w-[7rem]" />
            </colgroup>
            <thead>
              <tr className="text-[10.5px] font-bold text-on-ink lg:text-[11px]">
                <th scope="col" className="bg-ink py-2 pl-2.5 pr-1 text-left lg:px-3">Barber</th>
                {report.days.map((d) => {
                  const isToday = d.key === today;
                  return (
                    <th key={d.key} scope="col" className={cn("bg-ink px-0 py-1.5 text-center font-bold", isToday && "bg-[#333] text-white")}>
                      <span className="block leading-tight">{d.dow}</span>
                      <span className={cn("block text-[9.5px] font-semibold leading-tight", isToday ? "text-white" : "text-on-ink-muted")}>
                        {isToday ? "Today" : showYear ? d.date.slice(0, 5) + "/" + d.date.slice(-2) : d.date.slice(0, 5).replace(/^0/, "")}
                      </span>
                    </th>
                  );
                })}
                <th scope="col" className="bg-ink py-2 pl-1 pr-2.5 text-right lg:px-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {grouped ? grouped.map((g) => (
                <Fragment key={g.id}>
                  <tr><th scope="rowgroup" colSpan={report.days.length + 2} className="border-b border-line bg-grey-100 py-1.5 pl-2.5 pr-2 text-left text-[11px] font-extrabold lg:px-3">
                    <span className="block truncate">{g.name}</span>
                  </th></tr>
                  {g.rows.map((row) => renderRow(row))}
                  <tr className="font-bold">
                    <th scope="row" className="border-b border-line py-2 pl-2.5 pr-1 text-left text-[10.5px] text-muted lg:px-3">Subtotal</th>
                    {g.days.map((n, k) => { const day = report.days[k]; return <td key={day?.key ?? k} className="whitespace-nowrap border-b border-line px-0 py-2 text-center tabular-nums"><Amount n={n} future={!!day && day.key > today} bold /></td>; })}
                    <td className="whitespace-nowrap border-b border-line py-2 pl-1 pr-2.5 text-right tabular-nums lg:px-3"><span className="lg:hidden">{compactPeso(g.total)}</span><span className="hidden lg:inline">{peso(g.total)}</span></td>
                  </tr>
                </Fragment>
              )) : report.rows.map((row) => renderRow(row))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <th scope="row" className="bg-grey-100 py-3 pl-2.5 pr-1 text-left leading-tight lg:px-3">Totals</th>
                {report.daily.map((n, i) => {
                  const day = report.days[i];
                  return (
                    <td key={day?.key ?? i} className="whitespace-nowrap bg-grey-100 px-0 py-3 text-center tabular-nums">
                      <Amount n={n} future={!!day && day.key > today} bold />
                    </td>
                  );
                })}
                <td className="whitespace-nowrap bg-grey-100 py-3 pl-1 pr-2.5 text-right tabular-nums lg:px-3">
                  <span className="lg:hidden">{compactPeso(report.total)}</span><span className="hidden lg:inline">{peso(report.total)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="border-t border-line px-3 py-2 text-[10.5px] font-medium text-muted lg:hidden">Your share after each barber’s split · ₱, 1.6k = ₱1,600 · tap an amount for that day</p>
        </div>
      )}
    </div>
  );
}
