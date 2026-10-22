"use client";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { AppLoader } from "@/components/common/app-loader";
import { EmptyBookings } from "@/components/common/empty-bookings";
import { ChevronLeft, ChevronRight, Clock, Home as HomeIcon, MapPin } from "lucide-react";
import { mapsLink } from "@/lib/home-service-model";
import { completeCut } from "@/components/transactions/complete-flow";

import { payLabel, TransactionSheet } from "@/components/transactions/transaction-sheet";
import { CalendarDays } from "lucide-react";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { doneOnDay, monthGrid, queueDayLabel, todayKey } from "@/lib/queue-day";
import { EmptyState, SearchInput } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/page-back";
import { peso } from "@/lib/format";
import { ALL_LOCATIONS, HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopMenu } from "@/lib/shop-services";
import {
  completionLabel, markInChair, setRequestStatus, statusLabel, useQueueRequests,
  type ChairRequest,
} from "@/lib/chair-bookings";
import { visitMinutes } from "@/lib/visit-minutes";

type Channel = "walk-ins" | "online";

function matches(row: ChairRequest, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return row.ref.toLowerCase().includes(t)
    || row.customerLabel.toLowerCase().includes(t)
    || row.serviceName.toLowerCase().includes(t)
    || row.contact.toLowerCase().includes(t);
}

function Actions({ row, onFull }: { row: ChairRequest; onFull: (message: string) => void }) {
  // Home visits never take a chair: Accept confirms, the barber link moves it On the way → Arrived, anyone can finish it.
  if (row.home) {
    if (row.status === "requested") {
      return (
        <div className="mt-3 flex gap-2 border-t border-dashed border-[#E8E8EC] pt-3">
          <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => setRequestStatus(row.id, "declined")}>Decline</Button>
          <Button size="sm" className="flex-1" data-auth="action" onClick={() => setRequestStatus(row.id, "accepted")}>Accept</Button>
        </div>
      );
    }
    if (row.status === "accepted" || row.status === "in_chair") {
      return (
        <div className="mt-3 flex items-center gap-2 border-t border-dashed border-[#E8E8EC] pt-3">
          <span className="flex-1 text-[12.5px] font-bold text-muted">{row.homeStatus === "arrived" ? "Barber arrived" : row.homeStatus === "on_the_way" ? "Barber on the way" : "Confirmed"}</span>
          <Button size="sm" data-auth="action" onClick={() => completeCut(row)}>Done</Button>
        </div>
      );
    }
    return null;
  }
  if (row.status === "requested" || row.status === "accepted") {
    return (
      <div className="mt-3 flex gap-2 border-t border-dashed border-[#E8E8EC] pt-3">
        <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => setRequestStatus(row.id, "declined")}>Decline</Button>
        <Button data-auth="action" size="sm" className="flex-1" onClick={() => {
          const chair = markInChair(row.id);
          onFull(chair ? "" : "Every barber is busy. Finish a cut first.");
        }}>Accept</Button>
      </div>
    );
  }
  if (row.status === "in_chair") {
    return (
      <div className="mt-3 border-t border-dashed border-[#E8E8EC] pt-3">
        <Button size="sm" fullWidth data-auth="action" onClick={() => completeCut(row)}>Done</Button>
      </div>
    );
  }
  return null;
}

function Row({ row, onFull, place }: { row: ChairRequest; onFull: (message: string) => void; place?: string }) {
  const { haircut } = useShopMenu();
  const who = row.customerLabel || row.contact || "Walk-in";
  const where = row.status === "in_chair" && row.chairLabel ? row.chairLabel : row.slotLabel;
  const pay = row.paid ? payLabel(row) : row.payWhere === "online" ? "Pay online" : "Pay at the shop";
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-card bg-surface py-3 pl-3 pr-3.5 shadow-card">
      <div role="button" tabIndex={0} aria-label={`Open order ${row.ref}`} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(true); }} className="flex cursor-pointer items-center gap-3">
        <BarberIcon name={row.serviceId === "haircut" ? haircut.icon : "scissors"} size={40} title={row.serviceName} />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <b className="flex min-w-0 items-center gap-1.5 text-[15.5px] tracking-[-0.01em]"><span className="truncate">{who}</span>{row.home ? <span className="inline-flex h-5 flex-none items-center gap-0.5 rounded-pill bg-ink px-1.5 text-[10.5px] font-extrabold text-on-ink"><HomeIcon size={11} strokeWidth={2.4} aria-hidden />Home</span> : null}</b>
          <span className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {row.scheduledAt ? `Scheduled ${row.slotLabel}` : where}{row.scheduledAt && row.barberName ? ` · with ${row.barberName}` : ""}{place ? ` · ${place}` : ""}</span>
          <span className="mt-0.5 truncate text-[12.5px] font-semibold text-muted">
            {row.ref} · {pay}{row.status === "done" && row.completedAt ? ` · Completed ${completionLabel(row.completedAt)}` : ""}
          </span>
        </div>
        <b className="text-[14px]">{row.price ? peso(row.price) : statusLabel(row.status)}</b>
        <ChevronRight size={18} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
      </div>
      {row.home ? (
        <div className="mt-2 flex items-start gap-2 rounded-[12px] bg-grey-100 px-3 py-2 text-[12.5px] font-semibold">
          <MapPin size={14} strokeWidth={2.2} className="mt-0.5 flex-none" aria-hidden />
          <span className="min-w-0 flex-1"><span className="block">{row.home.address}</span><span className="text-muted">{row.home.distanceKm} km away{row.homeFee ? ` · Home fee ${peso(row.homeFee)} (in total)` : ""}</span></span>
          <a href={mapsLink(row.home.lat, row.home.lng)} target="_blank" rel="noopener noreferrer" className="flex-none font-extrabold underline underline-offset-2">Map</a>
        </div>
      ) : null}
      <Actions row={row} onFull={onFull} />
      {open ? <TransactionSheet row={row} onClose={() => setOpen(false)} /> : null}
    </li>
  );
}

/** Queue: walk-ins and online, with today’s sales on the same screen. */
export function QueueBoard() {
  const router = useRouter();
  const channel: Channel = useSearchParams().get("channel") === "online" ? "online" : "walk-ins";
  const [search, setSearch] = useState("");
  const [full, setFull] = useState("");
  const [day, setDay] = useState(() => todayKey());
  const [picking, setPicking] = useState(false);
  const isToday = day === todayKey();
  const dayText = queueDayLabel(day);
  const shops = useShopLocations();
  const { rows: loaded, ready, locationId: queueLoc, all: allLocs } = useQueueRequests();
  const placeOf = (r: ChairRequest) => (allLocs ? shops.branches.find((b) => b.id === (r.locationId || HOME_LOCATION_ID))?.name ?? "" : "");
  const rows = loaded.filter((r) => r.status !== "declined");

  const walkIns = useMemo(() => rows.filter((r) => r.channel === "walk-in"), [rows]);
  const online = useMemo(() => rows.filter((r) => r.channel === "online"), [rows]);
  const walkInList = useMemo(() => walkIns.filter((r) => matches(r, search)), [walkIns, search]);
  const onlineList = useMemo(() => online.filter((r) => matches(r, search)), [online, search]);
  const inChair = rows.filter((r) => r.status === "in_chair").length;
  const toAcceptCount = rows.filter((r) => r.status === "requested" || r.status === "accepted").length;

  const setChannel = (next: Channel) => {
    router.replace(next === "online" ? "/queue?channel=online" : "/queue", { scroll: false });
  };

  const list = channel === "walk-ins" ? walkInList : onlineList;
  // Open tickets are live, so they only show on Today; a past day shows that day's finished visits.
  const open = isToday ? list.filter((r) => r.status === "requested" || r.status === "accepted" || r.status === "in_chair") : [];
  // Finished visits on the chosen Manila day, newest first.
  const done = doneOnDay(list, day);

  if (!ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex items-center justify-between gap-3 border-b border-line px-1 pb-3">
        <div className="flex min-w-0 items-center gap-1">
          {channel === "online" ? (
            <button type="button" aria-label="Back to queue" onClick={() => setChannel("walk-ins")} className="inline-flex size-11 flex-none items-center justify-center rounded-full">
              <ChevronLeft size={24} strokeWidth={2.2} aria-hidden />
            </button>
          ) : <PageBack fallback="/home" />}
          <div className="min-w-0">
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{channel === "online" ? "Online orders" : "Queue"}</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">
              {inChair ? `${inChair} in service · ` : ""}{toAcceptCount} waiting
            </p>
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
        <SearchInput
          className="min-w-0 flex-1"
          label="Search the queue"
          placeholder={channel === "walk-ins" ? "Ticket or customer" : "Customer or haircut"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {full ? <p className="mt-3 px-1 text-[13.5px] font-semibold">{full}</p> : null}
      {!ready ? (
        <p className="mt-4 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading the queue…</p>
      ) : !isToday && done.length === 0 ? (
        search ? <EmptyState className="mt-4" title="No matches" /> : (
          <div className="mt-4 rounded-card bg-grey-50 px-5 py-6 text-center ring-1 ring-line">
            <b className="block text-[16px] tracking-[-0.01em]">Nothing completed on {dayText}</b>
            <p className="mt-1 text-[13px] font-medium text-muted">{channel === "online" ? "No online orders" : "No walk-ins"} were finished that day.</p>
          </div>
        )
      ) : open.length === 0 && done.length === 0 ? (
        search ? <EmptyState className="mt-4" title="No matches" /> : channel === "online"
          ? <EmptyBookings className="mt-4" locationId={queueLoc} />
          : <EmptyBookings className="mt-4" icon="ticket" title="No walk-ins yet" subtitle="Share your QR so customers can join the queue" locationId={queueLoc} />
      ) : null}

      <Section title="Now" rows={open} onFull={(message) => setFull(message)} placeOf={placeOf} />
      {done.length ? (
        <div className="mt-5">
          <p className="px-1 text-[13px] font-bold text-muted">Completed {isToday ? "today" : dayText} · {done.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card" aria-label={`Completed ${isToday ? "today" : dayText}`}>
            {done.map((row) => <DoneRow key={row.id} row={row} place={placeOf(row)} />)}
          </ul>
        </div>
      ) : null}
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

function Section({ title, rows, onFull, placeOf }: { title: string; rows: ChairRequest[]; onFull: (message: string) => void; placeOf?: (r: ChairRequest) => string }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="px-1 text-[12.5px] font-extrabold text-muted">{title}</p>
      <ul className="mt-3 flex flex-col gap-3" aria-label={title}>
        {rows.map((row) => <Row key={row.id} row={row} onFull={onFull} place={placeOf?.(row)} />)}
      </ul>
    </div>
  );
}


