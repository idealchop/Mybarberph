"use client";
import { AppLoader } from "@/components/common/app-loader";
import { EmptyBookings } from "@/components/common/empty-bookings";
import { ChevronDown, ChevronLeft, ChevronRight, Home as HomeIcon, MapPin } from "lucide-react";
import { mapsLink } from "@/lib/home-service-model";
import { useWalkInAllowance } from "@/lib/walkin-limit";
import { completeCut } from "@/components/transactions/complete-flow";

import { payLabel, TransactionSheet } from "@/components/transactions/transaction-sheet";
import { Plus } from "lucide-react";
import { EmptyState, SearchInput, StatCard } from "@river-apps/ui";
import { Button } from "@/components/common/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/page-back";
import { peso } from "@/lib/format";
import { ALL_LOCATIONS, HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopMenu } from "@/lib/shop-services";
import {
  completionLabel, markInChair, requestLocation, setRequestStatus, statusLabel, todayFigures, useQueueRequests,
  type ChairRequest,
  onlineOpenToday,
} from "@/lib/chair-bookings";
import { CountBadge } from "@/components/common/count-badge";
import { RangeChips, useSalesRows } from "@/features/sales";
import { rangeFetchDays, type SalesRange } from "@/lib/sales-report";
import { doneInRange, doneLabel } from "@/lib/done-range";

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
  const shops = useShopLocations();
  const { rows: loaded, ready, locationId: queueLoc, all: allLocs } = useQueueRequests();
  const placeOf = (r: ChairRequest) => (allLocs ? shops.branches.find((b) => b.id === (r.locationId || HOME_LOCATION_ID))?.name ?? "" : "");
  const rows = loaded.filter((r) => r.status !== "declined");
  const figures = todayFigures(loaded);
  // Done list: today (Manila) by default from the live queue; earlier days only when a date/range is picked.
  const [doneRange, setDoneRange] = useState<SalesRange>("today");
  const past = useSalesRows(rangeFetchDays(doneRange), true, doneRange !== "today");

  const walkIns = useMemo(() => rows.filter((r) => r.channel === "walk-in"), [rows]);
  const online = useMemo(() => rows.filter((r) => r.channel === "online"), [rows]);
  const onlineCount = onlineOpenToday(loaded).length;
  const walkInList = useMemo(() => walkIns.filter((r) => matches(r, search)), [walkIns, search]);
  const onlineList = useMemo(() => online.filter((r) => matches(r, search)), [online, search]);
  const inChair = rows.filter((r) => r.status === "in_chair").length;
  const toAcceptCount = rows.filter((r) => r.status === "requested" || r.status === "accepted").length;

  const setChannel = (next: Channel) => {
    router.replace(next === "online" ? "/queue?channel=online" : "/queue", { scroll: false });
  };

  const list = channel === "walk-ins" ? walkInList : onlineList;
  const open = list.filter((r) => r.status === "requested" || r.status === "accepted" || r.status === "in_chair");
  const live = new Set(loaded.map((r) => r.id));
  const pastRows = doneRange === "today" ? [] : (past ?? []).filter((r) => !live.has(r.id) && (allLocs || requestLocation(r) === queueLoc));
  const done = doneInRange([...list, ...pastRows.filter((r) => r.channel === (channel === "walk-ins" ? "walk-in" : "online") && matches(r, search))], doneRange);
  const anyDone = list.some((r) => r.status === "done");

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
        {channel === "walk-ins" ? (
          <button type="button" onClick={() => setChannel("online")} aria-label={`Online orders${onlineCount ? `, ${onlineCount} today` : ""}`} className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line px-3.5 text-[14px] font-bold text-ink">
            Online
            <CountBadge count={onlineCount} />
          </button>
        ) : null}
      </header>

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <p className="flex min-w-0 items-center text-[13px] font-bold text-muted">
          Today
          {shops.enabled ? (
            shops.branches.length > 1 ? (
              <label className="relative ml-1 inline-flex min-w-0 items-center gap-0.5 text-ink">
                <span className="truncate">· {shops.viewingAll ? "All locations" : shops.branches.find((b) => b.id === queueLoc)?.name ?? "Main"}</span>
                <ChevronDown size={14} strokeWidth={2.2} className="flex-none" aria-hidden />
                <select aria-label="Location" value={shops.viewingAll ? ALL_LOCATIONS : queueLoc} onChange={(e) => shops.setView(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                  {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  <option value={ALL_LOCATIONS}>All locations</option>
                </select>
              </label>
            ) : <span className="ml-1 truncate">· {allLocs ? "All locations" : shops.branches.find((b) => b.id === queueLoc)?.name ?? "Main"}</span>
          ) : null}
        </p>
        {channel === "walk-ins" ? <QueueWalkInButton locationId={queueLoc} /> : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard className="pb-3" label="Sales" value={peso(figures.sales)} caption={`${figures.cuts} cuts`} />
        <StatCard className="pb-3" label="Collection" value={peso(figures.extra.filter((r) => r.paid).reduce((s, r) => s + (r.price || 0), 0))} caption="Paid today" />
        <StatCard className="pb-3" label="Waiting" value={String(toAcceptCount)} />
        <StatCard className="pb-3" label="Done" value={String(figures.cuts)} />
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
      ) : list.length === 0 ? (
        search ? <EmptyState className="mt-4" title="No matches" /> : channel === "online"
          ? <EmptyBookings className="mt-4" locationId={queueLoc} />
          : <EmptyBookings className="mt-4" icon="ticket" title="No walk-ins yet" subtitle="Add a walk-in, or share your QR so customers can book" locationId={queueLoc} />
      ) : null}

      <Section title="Now" rows={open} onFull={(message) => setFull(message)} placeOf={placeOf} />
      {anyDone || doneRange !== "today" ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-1">
            <p className="text-[12.5px] font-extrabold text-muted">{doneLabel(doneRange)}</p>
            <RangeChips value={doneRange} onChange={setDoneRange} allowCustom />
          </div>
          {done.length ? (
            <ul className="mt-3 flex flex-col gap-3" aria-label={doneLabel(doneRange)}>
              {done.map((row) => <Row key={row.id} row={row} onFull={(message) => setFull(message)} place={placeOf(row)} />)}
            </ul>
          ) : (
            <p className="mt-3 rounded-card bg-surface px-4 py-5 text-center text-[13.5px] font-semibold text-muted shadow-card">
              {doneRange !== "today" && !past ? "Loading…" : doneRange === "today" ? "No finished visits yet today." : "No finished visits for this date."}
            </p>
          )}
        </div>
      ) : null}

    </div>
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


/** Compact "Walk-in" pill next to Today: opens the add walk-in flow; Partner shops at 10/day see Upgrade instead. */
function QueueWalkInButton({ locationId }: { locationId: string }) {
  const allowance = useWalkInAllowance(locationId);
  if (allowance.atLimit) {
    return (
      <Button href="/settings/billing" size="sm" variant="secondary" className="h-9 rounded-pill px-3.5 text-[13px]" title={allowance.message}>
        0 left · Upgrade
      </Button>
    );
  }
  return (
    <Button href="/queue/new" size="sm" data-auth="action" className="h-9 rounded-pill px-3.5 text-[13px]" leadingIcon={<Plus size={16} strokeWidth={2.4} />}
      aria-label={allowance.unlimited ? "Add walk-in" : `Add walk-in, ${allowance.label}`}>
      Walk-in
    </Button>
  );
}
