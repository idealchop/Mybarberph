"use client";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { AppLoader } from "@/components/common/app-loader";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { payLabel, TransactionSheet } from "@/components/transactions/transaction-sheet";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { doneOnDay, monthGrid, queueDayLabel, todayKey } from "@/lib/queue-day";
import { EmptyState, SearchInput } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useMemo, useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { peso } from "@/lib/format";
import { ALL_LOCATIONS, HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useChairRequests, useQueueRequests, type ChairRequest } from "@/lib/chair-bookings";
import { mergeLiveRows } from "@/lib/cut-count";
import { rowsForLocation } from "@/lib/queue-location";
import { useSalesRows } from "@/features/sales/use-sales-rows";
import { visitMinutes } from "@/lib/visit-minutes";

function matches(row: ChairRequest, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return row.ref.toLowerCase().includes(t)
    || row.customerLabel.toLowerCase().includes(t)
    || row.serviceName.toLowerCase().includes(t)
    || row.contact.toLowerCase().includes(t);
}

/**
 * Owner Queue: a read-only record of completed visits (walk-ins and online together) for one Manila day
 * and location. No QR, no accept/decline/finish here; barbers run the live queue from their link.
 */
export function QueueBoard() {
  const [search, setSearch] = useState("");
  const [day, setDay] = useState(() => todayKey());
  const [picking, setPicking] = useState(false);
  const isToday = day === todayKey();
  const dayText = queueDayLabel(day);
  const shops = useShopLocations();
  const { rows, ready, locationId: queueLoc, all: allLocs } = useQueueRequests();
  const placeOf = (r: ChairRequest) => (allLocs ? shops.branches.find((b) => b.id === (r.locationId || HOME_LOCATION_ID))?.name ?? "" : "");
  // v1.0.24: the live list is only the newest 300 bookings; count the day from the server window (sales-rows, same
  // whole-Manila-day source as the barber History), merged with live copies (newer wins), scoped like the live rows.
  const back = Math.min(3650, Math.max(2, Math.round((Date.parse(`${todayKey()}T00:00:00+08:00`) - Date.parse(`${day}T00:00:00+08:00`)) / 86_400_000) + 2));
  const deep = useSalesRows(back);
  const live = useChairRequests().rows;
  const scoped = useMemo(() => (deep ? rowsForLocation(mergeLiveRows(deep, live), queueLoc, allLocs, HOME_LOCATION_ID) : rows), [deep, live, rows, queueLoc, allLocs]);
  const dayDone = useMemo(() => doneOnDay(scoped, day), [scoped, day]);
  const done = useMemo(() => dayDone.filter((r) => matches(r, search)), [dayDone, search]);
  const when = isToday ? "today" : dayText;

  if (!ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex items-center justify-between gap-3 border-b border-line px-1 pb-3">
        <div className="flex min-w-0 items-center gap-1">
          <PageBack fallback="/home" />
          <div className="min-w-0">
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Queue</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">{dayDone.length} completed{isToday ? "" : ` · ${dayText}`}</p>
          </div>
        </div>
      </header>

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <p className="flex min-w-0 items-center text-[13px] font-bold text-muted">
          <span className={isToday ? "" : "text-ink"}>{dayText}</span>
          {shops.enabled ? (
            shops.branches.length > 1 ? (
              <LocationSwitcher className="ml-1 text-ink" value={shops.viewingAll ? ALL_LOCATIONS : queueLoc} allId={ALL_LOCATIONS} onChange={shops.setView}
                label={`· ${shops.viewingAll ? "All locations" : shops.branches.find((b) => b.id === queueLoc)?.name ?? "Main"}`}
                options={shops.branches.map((b) => ({ id: b.id, name: b.name, sub: b.area || b.address }))} />
            ) : <span className="ml-1 truncate">· {allLocs ? "All locations" : shops.branches.find((b) => b.id === queueLoc)?.name ?? "Main"}</span>
          ) : null}
        </p>
        <div className="flex flex-none items-center gap-1.5">
          {!isToday ? (
            <button type="button" onClick={() => setDay(todayKey())} className="h-9 rounded-pill bg-surface px-3.5 text-[13px] font-bold shadow-card">Today</button>
          ) : null}
          <button type="button" aria-label={`Pick date, showing ${isToday ? "today" : dayText}`} aria-haspopup="dialog" onClick={() => setPicking(true)}
            className={`inline-flex size-9 items-center justify-center rounded-full ${isToday ? "bg-surface text-ink shadow-card" : "bg-ink text-on-ink"}`}>
            <CalendarDays size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <SearchInput className="min-w-0 flex-1" label="Search completed orders" placeholder="Ticket, customer or haircut" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {done.length === 0 ? (
        search && dayDone.length ? <EmptyState className="mt-4" title="No matches" /> : (
          <div className="mt-4 rounded-card bg-grey-50 px-5 py-6 text-center ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons3d/barbers/128/orders.webp" alt="" width={56} height={56} className="mx-auto size-14 object-contain" />
            <b className="mt-3 block text-[16px] tracking-[-0.01em]">{isToday ? "No completed orders yet" : `Nothing completed on ${dayText}`}</b>
            <p className="mt-1 text-[13px] font-medium text-muted">{isToday ? "Finished walk-ins and online orders show up here." : "No walk-ins or online orders were finished that day."}</p>
          </div>
        )
      ) : (
        <div className="mt-5">
          <p className="px-1 text-[13px] font-bold text-muted">Completed {when} · {done.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card" aria-label={`Completed ${when}`}>
            {done.map((row) => <DoneRow key={row.id} row={row} place={placeOf(row)} />)}
          </ul>
        </div>
      )}
      {picking ? <DayPicker value={day} onPick={(k) => { setDay(k); setPicking(false); }} onClose={() => setPicking(false)} /> : null}
    </div>
  );
}

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

/** Calendar sheet: one month at a time, future days disabled, today ringed, chosen day filled. */
function DayPicker({ value, onPick, onClose }: { value: string; onPick: (key: string) => void; onClose: () => void }) {
  const today = todayKey();
  const [ym, setYm] = useState(() => { const [y = 2026, m = 1] = value.split("-").map(Number); return { y, m: m - 1 }; });
  const [ty = 2026, tm = 1] = today.split("-").map(Number);
  const atLatest = ym.y > ty || (ym.y === ty && ym.m >= tm - 1);
  const shift = (d: number) => setYm(({ y, m }) => { const n = y * 12 + m + d; return { y: Math.floor(n / 12), m: n % 12 }; });
  const title = new Date(Date.UTC(ym.y, ym.m, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <BottomSheet title="Pick a date" subtitle="Show completed visits for one day" onClose={onClose}>
      <div className="flex items-center justify-between px-1">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="inline-flex size-10 items-center justify-center rounded-full active:bg-grey-100"><ChevronLeft size={20} strokeWidth={2.2} aria-hidden /></button>
        <b className="text-[15.5px]">{title}</b>
        <button type="button" aria-label="Next month" disabled={atLatest} onClick={() => shift(1)} className="inline-flex size-10 items-center justify-center rounded-full active:bg-grey-100 disabled:opacity-30"><ChevronRight size={20} strokeWidth={2.2} aria-hidden /></button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={title}>
        {WEEK.map((w, i) => <span key={i} className="py-1 text-[12px] font-bold text-muted">{w}</span>)}
        {monthGrid(ym.y, ym.m).map((k, i) => {
          if (!k) return <span key={`p${i}`} />;
          const future = k > today, on = k === value, isT = k === today;
          return (
            <button key={k} type="button" disabled={future} aria-pressed={on} aria-label={queueDayLabel(k)} onClick={() => onPick(k)}
              className={`mx-auto inline-flex size-10 items-center justify-center rounded-full text-[14.5px] font-bold tabular-nums disabled:text-subtle disabled:opacity-40 ${on ? "bg-ink text-on-ink" : isT ? "ring-1 ring-ink" : "active:bg-grey-100"}`}>
              {Number(k.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2 pb-1">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => onPick(today)}>Today</Button>
      </div>
    </BottomSheet>
  );
}

const timeOf = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");

/** One finished visit: completion time, customer/ticket, service · barber, amount. Tap for details. */
export function DoneRow({ row, place }: { row: ChairRequest; place?: string }) {
  const [open, setOpen] = useState(false);
  const who = row.customerLabel && row.customerLabel !== "Walk-in" ? row.customerLabel : row.contact || "Walk-in";
  const mins = visitMinutes(row);
  const when = [timeOf(row.completedAt ?? row.updatedAt), mins != null ? `${mins} min` : ""].filter(Boolean).join(" · ");
  return (
    <li>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Open ${row.ref}`} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1 leading-[1.3]">
          <span className="flex min-w-0 items-center gap-2">
            <b className="min-w-0 truncate text-[14.5px]">{who}</b>
            <span className="inline-flex flex-none items-center gap-1 text-[12px] font-semibold text-muted tabular-nums"><Clock size={12} strokeWidth={2.2} aria-hidden />{when}</span>
          </span>
          <span className="block truncate text-[12.5px] font-semibold text-muted">{[row.serviceName, row.barberName, place].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex-none text-right leading-tight">
          <b className="block text-[15px] tabular-nums">{peso(row.price || 0)}</b>
          <small className={`text-[11.5px] font-semibold ${row.paid ? "text-muted" : "text-[#B45309]"}`}>{row.paid ? payLabel(row).replace("Paid · ", "") : "Unpaid"}</small>
        </span>
        <ChevronRight size={16} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
      </button>
      {open ? <TransactionSheet row={row} onClose={() => setOpen(false)} /> : null}
    </li>
  );
}
