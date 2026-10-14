"use client";

import { useState } from "react";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { Topbar } from "@river-apps/ui";
import { PageBack } from "@/components/shell/PageBack";
import { peso } from "@/lib/format";
import { statusLabel, useScopedRequests, type ChairRequest } from "@/lib/chair-bookings";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";

/** Past visits, opened from Settings. */
export function HistoryScreen() {
  const shops = useShopLocations();
  const { rows, ready } = useScopedRequests();
  const done = rows.filter((row) => row.status === "done");
  const groups = shops.viewingAll
    ? shops.branches.map((branch) => ({ branch, rows: done.filter((row) => (row.locationId || HOME_LOCATION_ID) === branch.id) })).filter((group) => group.rows.length)
    : [];
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="History" subtitle={ready ? `${done.length} finished` : "Loading"} />
      {shops.viewingAll ? groups.map((group) => (
        <section key={group.branch.id} className="mt-4">
          <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">{group.branch.name}</h2>
          <VisitList rows={group.rows} />
        </section>
      )) : <VisitList rows={done} />}
    </div>
  );
}

function VisitList({ rows }: { rows: ChairRequest[] }) {
  const [open, setOpen] = useState<ChairRequest | null>(null);
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {open ? <TransactionSheet row={rows.find((r) => r.id === open.id) ?? open} onClose={() => setOpen(null)} /> : null}
      {rows.map((row) => (
        <li key={row.id} role="button" tabIndex={0} aria-label={`View details for ${row.ref}`} onClick={() => setOpen(row)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(row); }} className="flex cursor-pointer items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card">
          <span className="min-w-0">
            <b className="block truncate">{row.customerLabel || row.contact}</b>
            <small className="text-[12.5px] font-semibold text-muted">{row.serviceName} · {row.ref} · {statusLabel(row.status)}</small>
          </span>
          <b>{peso(row.price)}</b>
        </li>
      ))}
    </ul>
  );
}
