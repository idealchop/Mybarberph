"use client";

import { useNow } from "@/lib/use-now";
import { AppLoader } from "@/components/common/app-loader";
import { PageBack } from "@/components/shell/page-back";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { compactPeso, groupProfitRows, profitMonth, profitWeek, type ProfitRow } from "@/lib/profit-report";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { useCloud } from "@/lib/cloud";
import { normalizeGroups, SALES_GROUPS_KEY } from "@/lib/sales-groups";
import { cn } from "@river-apps/ui";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useSalesRows } from "./use-sales-rows";
import { ProfitDaySheet, type DayTarget } from "./profit-day-sheet";
import { ProfitDayBreakdown, ProfitMonthCalendar } from "./profit-month-calendar";
import { mergeLiveRows } from "@/lib/cut-count";
import { cellClaimState, claimStates } from "@/lib/profit-claim";
import { useRemit } from "./use-remit";
import { ProfitChart } from "./profit-chart";

const FETCH_DAYS = 100;
/** Month view reaches back this many months (rows are fetched for FETCH_DAYS). */
const MONTHS_BACK = 2;
/** Off = plain barber list; on = grouped by the owner's saved Sales groups (Jimboy, 2026-10-27: one toggle, starts off). */
type View = "list" | "groups";
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
  // Deep rows (70 days) plus live edits: a record added, edited or deleted from the day sheet shows at once.
  const rows = useMemo(() => mergeLiveRows(deep, cloud.rows), [deep, cloud.rows]);
  const remitAll = useRemit("all");
  // Red = cash still to claim that day, green = all claimed (Jimboy, 2026-10-30).
  const claimMap = useMemo(() => (remitAll.data ? claimStates(rows, chairs, (r) => Boolean(remitAll.claimOf(r.id))) : null), [rows, chairs, remitAll]);
  const [sheet, setSheet] = useState<DayTarget | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState("");
  const [mode, setMode] = useState<"week" | "month">("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [view, setView] = useState<View>("list");
  const cloudValues = useCloud().values;
  const salesGroups = useMemo(() => { try { return normalizeGroups(JSON.parse(cloudValues[SALES_GROUPS_KEY] || "null")); } catch { return normalizeGroups(null); } }, [cloudValues]);
  const branches = useMemo(
    () => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]),
    [shops.enabled, shops.branches, profile.name],
  );
  // Default: All locations (Jimboy, 2026-10-27), whatever location the rest of the app is on.
  const multi = shops.enabled && branches.length > 1;
  const where = multi ? picked || "all" : "all";
  const today = todayKey();
  const week = profitWeek(rows, chairs, where, offset, now, branches);
  const month = mode === "month" ? profitMonth(rows, chairs, where, monthOffset, now, branches) : null;
  const showYear = new Set(week.days.map((d) => d.date.slice(-4))).size > 1;
  const todayStart = Date.parse(`${today}T00:00:00+08:00`);
  /** One shape for both views: week = 7 tappable days, month = W1…W5 week columns. */
  const report = month
    ? { label: month.label, rows: month.rows, daily: month.daily, total: month.total,
        cols: month.weeks.map((w) => ({ key: w.key, top: w.label, sub: w.range, future: w.from > todayStart, today: false, day: undefined as string | undefined })) }
    : { label: week.label, rows: week.rows, daily: week.daily, total: week.total,
        cols: week.days.map((d) => ({ key: d.key, top: d.dow, sub: d.key === today ? "Today" : showYear ? d.date.slice(0, 5) + "/" + d.date.slice(-2) : d.date.slice(0, 5).replace(/^0/, ""), future: d.key > today, today: d.key === today, day: d.key as string | undefined })) };
  const canGroup = where === "all" && multi;
  /** Short range for the card: "Oct 2026" (month) or "Oct 26 – Nov 1" (week; year only when it isn't this year). */
  const shortLabel = month
    ? new Date(month.from + 12 * 3600_000).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", year: "numeric" })
    : week.label.endsWith(`, ${today.slice(0, 4)}`) ? week.label.slice(0, -6) : week.label;
  const grouped = canGroup && view === "groups" ? groupProfitRows(report.rows, salesGroups) : null;

  const renderRow = (row: ProfitRow) => (
                <tr key={`${row.id}@${row.locationId}`}>
                  <th scope="row" className="border-b border-line py-2.5 pl-2.5 pr-1 text-left lg:px-3">
                    <Link href={barberHref(row)} className="block truncate font-semibold underline decoration-line decoration-dotted underline-offset-2">{row.name}</Link>
                    {where === "all" && row.locationName ? <span className="mt-0.5 block truncate text-[10px] font-medium text-muted lg:text-[11px]">{row.locationName}</span> : null}
                  </th>
                  {row.days.map((n, i) => {
                    const c = report.cols[i];
                    const st = c?.day ? cellClaimState(claimMap?.get(`${row.id}@${row.locationId}|${c.day}`)) : null;
                    return (
                      <td key={c?.key ?? i} className={cn("whitespace-nowrap border-b border-line p-0 text-center tabular-nums", c?.today && "bg-grey-100")}>
                        {c && !c.future && c.day ? (
                          <button type="button" onClick={() => setSheet({ id: row.id, name: row.name, locationId: row.locationId, locationName: row.locationName, day: c.day! })}
                            aria-label={`${row.name}, ${c.top} ${c.sub}: ${n ? peso(n) : "no sales"}${st === "open" ? ", unclaimed" : st === "claimed" ? ", claimed" : ""}. Claim, records and add`}
                            className="flex min-h-11 w-full items-center justify-center py-1 active:bg-grey-200">
                            {n ? <span className={cn("border-b border-dotted leading-tight", st === "open" ? "border-[#C62828]/60 text-[#C62828]" : st === "claimed" ? "border-[#0B7A3E]/60 text-[#0B7A3E]" : "border-muted/70")}><Amount n={n} future={false} /></span> : <Amount n={0} future={false} />}
                          </button>
                        ) : (
                          <span className="flex min-h-11 items-center justify-center"><Amount n={n} future={!!c?.future} /></span>
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
        <h1 className="min-w-0 text-[22px] font-extrabold leading-tight tracking-[-0.03em]">{month ? "Monthly" : "Weekly"} Profit Report</h1>
      </div>

      <section aria-label="Your profit" className="mt-3 rounded-banner bg-ink py-3 pl-4 pr-2 text-on-ink">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[12.5px] font-semibold text-on-ink-muted">Your profit</p>
          <div role="group" aria-label={month ? "Month" : "Week"} className="flex h-11 flex-none items-center rounded-pill bg-white/10">
            <button type="button" aria-label={month ? "Previous month" : "Previous week"} disabled={!!month && monthOffset <= -MONTHS_BACK} onClick={() => (month ? setMonthOffset((n) => Math.max(-MONTHS_BACK, n - 1)) : setOffset((n) => Math.max(-8, n - 1)))}
              className="inline-flex size-11 items-center justify-center rounded-full text-on-ink active:bg-white/15 disabled:opacity-30"><ChevronLeft size={17} strokeWidth={2.4} /></button>
            <span aria-live="polite" className="whitespace-nowrap text-[12.5px] font-bold tabular-nums">{shortLabel}</span>
            <button type="button" aria-label={month ? "Next month" : "Next week"} disabled={month ? monthOffset >= 0 : offset >= 0} onClick={() => (month ? setMonthOffset((n) => Math.min(0, n + 1)) : setOffset((n) => Math.min(0, n + 1)))}
              className="inline-flex size-11 items-center justify-center rounded-full text-on-ink active:bg-white/15 disabled:opacity-30"><ChevronRight size={17} strokeWidth={2.4} /></button>
          </div>
        </div>
        <b className="mt-1 block pr-2 text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(report.total)}</b>
        <p className="mb-1 mt-2 pr-2 text-[12.5px] font-semibold text-on-ink-muted">{report.rows.length === 0 ? "No finished haircuts" : `After barber commissions · ${report.rows.length} barber${report.rows.length === 1 ? "" : "s"}`}</p>
      </section>

      <div className="mt-3 flex items-center gap-2">
        {multi ? (
          <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-pill bg-surface px-3 shadow-card">
            <MapPin size={14} className="flex-none text-muted" aria-hidden />
            <LocationSwitcher className="flex-1 text-[12.5px] font-bold" value={where} allId="all" onChange={setPicked}
              label={where === "all" ? "All locations" : branches.find((b) => b.id === where)?.name ?? "Main"}
              options={shops.branches.map((b) => ({ id: b.id, name: b.name, sub: b.area || b.address }))} />
          </div>
        ) : <span className="flex-1" />}
        {canGroup ? (
          <button type="button" aria-pressed={view === "groups"} onClick={() => setView(view === "groups" ? "list" : "groups")}
            className={cn("h-9 flex-none whitespace-nowrap rounded-pill px-3.5 text-[12.5px] font-bold shadow-card", view === "groups" ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>Sales group</button>
        ) : null}
        <button type="button" aria-pressed={!!month} aria-label={month ? "Show week view" : "Show month view"} title={month ? "Week view" : "Month view"}
          onClick={() => { setMode(month ? "week" : "month"); setMonthOffset(0); }}
          className={cn("inline-flex size-9 flex-none items-center justify-center rounded-full shadow-card", month ? "bg-ink text-on-ink" : "bg-surface text-ink")}>
          {month ? <CalendarRange size={17} strokeWidth={2.2} /> : <CalendarDays size={17} strokeWidth={2.2} />}
        </button>
      </div>

      {month ? <ProfitMonthCalendar m={month} today={today} onPick={setDayOpen} /> : null}

      {report.rows.length === 0 ? null : (
        <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[11.5px] lg:text-[12.5px]">
            <colgroup>
              <col className="w-[4.6rem] lg:w-[11rem]" />
              {report.cols.map((c) => <col key={c.key} />)}
              <col className="w-[2.9rem] lg:w-[7rem]" />
            </colgroup>
            <thead>
              <tr className="text-[10.5px] font-bold text-on-ink lg:text-[11px]">
                <th scope="col" className="bg-ink py-2 pl-2.5 pr-1 text-left lg:px-3">Barber</th>
                {report.cols.map((c) => (
                  <th key={c.key} scope="col" className={cn("bg-ink px-0 py-1.5 text-center font-bold", c.today && "bg-[#333] text-white")}>
                    <span className="block leading-tight">{c.top}</span>
                    <span className={cn("block text-[9.5px] font-semibold leading-tight", c.today ? "text-white" : "text-on-ink-muted")}>{c.sub}</span>
                  </th>
                ))}
                <th scope="col" className="bg-ink py-2 pl-1 pr-2.5 text-right lg:px-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {grouped ? grouped.map((g) => (
                <Fragment key={g.id}>
                  <tr><th scope="rowgroup" colSpan={report.cols.length + 2} className="border-b border-line bg-grey-100 py-1.5 pl-2.5 pr-2 text-left text-[11px] font-extrabold lg:px-3">
                    <span className="block truncate">{g.name}</span>
                  </th></tr>
                  {g.rows.map((row) => renderRow(row))}
                  <tr className="font-bold">
                    <th scope="row" className="border-b border-line py-2 pl-2.5 pr-1 text-left text-[10.5px] text-muted lg:px-3">Subtotal</th>
                    {g.days.map((n, k) => { const c = report.cols[k]; return <td key={c?.key ?? k} className="whitespace-nowrap border-b border-line px-0 py-2 text-center tabular-nums"><Amount n={n} future={!!c?.future} bold /></td>; })}
                    <td className="whitespace-nowrap border-b border-line py-2 pl-1 pr-2.5 text-right tabular-nums lg:px-3"><span className="lg:hidden">{compactPeso(g.total)}</span><span className="hidden lg:inline">{peso(g.total)}</span></td>
                  </tr>
                </Fragment>
              )) : report.rows.map((row) => renderRow(row))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <th scope="row" className="bg-grey-100 py-3 pl-2.5 pr-1 text-left leading-tight lg:px-3">Totals</th>
                {report.daily.map((n, i) => {
                  const c = report.cols[i];
                  return (
                    <td key={c?.key ?? i} className="whitespace-nowrap bg-grey-100 px-0 py-3 text-center tabular-nums">
                      <Amount n={n} future={!!c?.future} bold />
                    </td>
                  );
                })}
                <td className="whitespace-nowrap bg-grey-100 py-3 pl-1 pr-2.5 text-right tabular-nums lg:px-3">
                  <span className="lg:hidden">{compactPeso(report.total)}</span><span className="hidden lg:inline">{peso(report.total)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {report.rows.length && !month ? (
        <p className="mt-2 flex items-center gap-3 px-1 text-[11.5px] font-semibold text-muted">
          <span className="inline-flex items-center gap-1"><i aria-hidden className="size-2 rounded-full bg-[#C62828]" />To claim</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden className="size-2 rounded-full bg-[#0B7A3E]" />Claimed</span>
        </p>
      ) : null}
      {!month && report.rows.length ? <ProfitChart rows={report.rows} showBranch={where === "all"} label={shortLabel} /> : null}
      {month && dayOpen && !sheet ? (
        <ProfitDayBreakdown m={month} date={dayOpen} groups={grouped ? salesGroups : null} showBranch={where === "all"} onClose={() => setDayOpen(null)}
          onBarber={(r) => setSheet({ id: r.id, name: r.name, locationId: r.locationId, locationName: r.locationName, day: dayOpen })} />
      ) : null}
      {sheet ? <ProfitDaySheet t={sheet} rows={rows} chairs={chairs} profileHref={barberHref(sheet, sheet.day)} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
