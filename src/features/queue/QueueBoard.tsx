"use client";
import { EmptyBookings } from "@/components/common/EmptyBookings";
import { ChevronRight } from "lucide-react";
import { useWalkInAllowance } from "@/lib/walkin-limit";
import { completeCut } from "@/components/transactions/CompleteFlow";

import { payLabel, TransactionSheet } from "@/components/transactions/TransactionSheet";
import { Plus } from "lucide-react";
import { Button, EmptyState, SearchInput, StatCard, cn } from "@river-apps/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/PageBack";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopMenu } from "@/lib/shop-services";
import {
  completionLabel, markInChair, setRequestStatus, statusLabel, todayFigures, useQueueRequests,
  type ChairRequest,
} from "@/lib/chair-bookings";

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

function Row({ row, onFull }: { row: ChairRequest; onFull: (message: string) => void }) {
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
          <b className="truncate text-[15.5px] tracking-[-0.01em]">{who}</b>
          <span className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {where}</span>
          <span className="mt-0.5 truncate text-[12.5px] font-semibold text-muted">
            {row.ref} · {pay}{row.status === "done" && row.completedAt ? ` · Completed ${completionLabel(row.completedAt)}` : ""}
          </span>
        </div>
        <b className="text-[14px]">{row.price ? peso(row.price) : statusLabel(row.status)}</b>
        <ChevronRight size={18} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
      </div>
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
  const { rows: loaded, ready, locationId: queueLoc } = useQueueRequests();
  const rows = loaded.filter((r) => r.status !== "declined");
  const figures = todayFigures(loaded);

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
  const open = list.filter((r) => r.status === "requested" || r.status === "accepted" || r.status === "in_chair");
  const done = list.filter((r) => r.status === "done");

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex flex-wrap items-end gap-x-6 border-b border-line px-1">
        <div className="flex items-center gap-1 pb-3">
          <PageBack fallback="/home" />
          <div>
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Queue</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">
              {inChair ? `${inChair} barber${inChair === 1 ? "" : "s"} busy` : "Barbers free"} · {toAcceptCount} waiting
            </p>
          </div>
        </div>
        <div role="tablist" aria-label="Queue channel" className="flex items-end gap-6">
          {([
            ["walk-ins", "Walk-ins", walkIns.length],
            ["online", "Online", online.length],
          ] as const).map(([value, label, count]) => {
            const on = channel === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setChannel(value)}
                className={cn(
                  "-mb-px min-h-11 border-b-2 px-0.5 pb-2.5 pt-2 text-[15px]",
                  on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-muted",
                )}
              >
                {label}
                {count ? <span className="ml-1.5 tabular-nums">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </header>
      {shops.enabled && shops.branches.length > 1 ? (
        <div className="mt-3">
          {shops.viewingAll ? <p className="px-1 text-[12.5px] font-semibold text-muted">The queue is per shop. Showing the main shop; pick one:</p> : null}
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Shop">
            {shops.branches.map((b) => (
              <button key={b.id} type="button" aria-pressed={!shops.viewingAll && queueLoc === b.id} onClick={() => shops.setView(b.id)}
                className={cn("h-9 flex-none rounded-pill px-3.5 text-[13px] font-bold", !shops.viewingAll && queueLoc === b.id ? "bg-ink text-on-ink" : "bg-surface shadow-card")}>{b.name}</button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <p className="text-[13px] font-bold text-muted">Today{shops.enabled ? ` · ${shops.branches.find((b) => b.id === queueLoc)?.name ?? "Main"}` : ""}</p>
        <QueueWalkInButton locationId={queueLoc} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard className="pb-3" label="Sales" value={peso(figures.sales)} caption={`${figures.cuts} cuts`} />
        <Link href="/queue/seats" aria-label="Barbers busy" className="block rounded-card">
          <StatCard className="pb-3" label="Busy barbers" value={String(inChair)} />
        </Link>
        <StatCard className="pb-3" label="Waiting" value={String(toAcceptCount)} />
        <StatCard className="pb-3" label="Done" value={String(rows.filter((r) => r.status === "done").length)} />
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

      <Section title="Now" rows={open} onFull={(message) => setFull(message)} />
      <Section title="Done today" rows={done} onFull={(message) => setFull(message)} />

    </div>
  );
}

function Section({ title, rows, onFull }: { title: string; rows: ChairRequest[]; onFull: (message: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">{title}</p>
      <ul className="mt-3 flex flex-col gap-3" aria-label={title}>
        {rows.map((row) => <Row key={row.id} row={row} onFull={onFull} />)}
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
