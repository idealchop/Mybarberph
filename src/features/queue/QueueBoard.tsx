"use client";
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
  completionLabel, markInChair, setRequestStatus, statusLabel, todayFigures, useScopedRequests,
  type ChairRequest,
} from "@/lib/chair-bookings";
import { useTier } from "@/lib/tier";

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
          onFull(chair ? "" : "Every chair is taken. Finish a cut first.");
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
  const pay = row.paid ? payLabel(row) : row.payWhere === "online" ? "Pay online" : "Pay at the chair";
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-card bg-surface py-3 pl-3 pr-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <BarberIcon name={row.serviceId === "haircut" ? haircut.icon : "scissors"} size={40} title={row.serviceName} />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <b className="truncate text-[15.5px] tracking-[-0.01em]">{who}</b>
          <span className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {where}</span>
          <span className="mt-0.5 truncate text-[12.5px] font-semibold text-muted">
            {row.ref} · {pay}{row.status === "done" && row.completedAt ? ` · Completed ${completionLabel(row.completedAt)}` : ""}
          </span>
        </div>
        <b className="text-[14px]">{row.price ? peso(row.price) : statusLabel(row.status)}</b>
      </div>
      <Actions row={row} onFull={onFull} />
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]">View details</button>
      {open ? <TransactionSheet row={row} onClose={() => setOpen(false)} /> : null}
    </li>
  );
}

/** Queue: walk-ins and online, with today’s sales on the same screen. */
export function QueueBoard() {
  const { tier } = useTier();
  const paid = tier === "paid";
  const router = useRouter();
  const channel: Channel = useSearchParams().get("channel") === "online" ? "online" : "walk-ins";
  const [search, setSearch] = useState("");
  const [full, setFull] = useState("");
  const shops = useShopLocations();
  const { rows: loaded, ready } = useScopedRequests();
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
              {inChair} in chair · {toAcceptCount} to accept
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

      <p className="mt-4 px-1 text-[13px] font-bold text-muted">{shops.viewingAll ? "Today · all shops" : "Today"}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard className="pb-3" label="Sales" value={peso(figures.sales)} caption={`${figures.cuts} cuts`} />
        <Link href="/queue/seats" aria-label="In chair" className="block rounded-card">
          <StatCard className="pb-3" label="In chair" value={String(inChair)} />
        </Link>
        <StatCard className="pb-3" label="To accept" value={String(toAcceptCount)} />
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
        {paid && channel === "walk-ins" ? (
          <Button href="/queue/new" size="md" aria-label="New walk-in" leadingIcon={<Plus size={18} strokeWidth={2.2} />} className="flex-none px-4">
            Walk-in
          </Button>
        ) : null}
      </div>

      {full ? <p className="mt-3 px-1 text-[13.5px] font-semibold">{full}</p> : null}
      {!ready ? (
        <p className="mt-4 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading the queue…</p>
      ) : list.length === 0 ? (
        <EmptyState
          className="mt-4"
          title={search ? "No matches" : channel === "online" ? "No bookings yet" : "The chairs are clear"}
          description={search ? undefined : channel === "online" ? "Customers who scan the shop QR show up here." : "Walk-ins you add at the chair show up here."}
        />
      ) : null}

      {shops.viewingAll ? shops.branches.map((branch) => (
        <Section
          key={`${branch.id}-open`}
          title={`${branch.name} · Now`}
          rows={open.filter((row) => (row.locationId || HOME_LOCATION_ID) === branch.id)}
          onFull={(message) => setFull(message)}
        />
      )) : <Section title="Now" rows={open} onFull={(message) => setFull(message)} />}
      {shops.viewingAll ? shops.branches.map((branch) => (
        <Section
          key={`${branch.id}-done`}
          title={`${branch.name} · Done today`}
          rows={done.filter((row) => (row.locationId || HOME_LOCATION_ID) === branch.id)}
          onFull={(message) => setFull(message)}
        />
      )) : <Section title="Done today" rows={done} onFull={(message) => setFull(message)} />}

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

