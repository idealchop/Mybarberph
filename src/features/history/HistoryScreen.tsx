"use client";
import { ChevronRight, MapPin } from "lucide-react";

import { useState } from "react";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { Topbar } from "@river-apps/ui";
import { PageBack } from "@/components/shell/PageBack";
import { peso } from "@/lib/format";
import { useChairRequests, type ChairRequest } from "@/lib/chair-bookings";
import type { SalesRange } from "@/lib/sales-report";
import { inRange } from "@/lib/sales-stats";
import { RangeChips } from "@/features/sales/SalesParts";
import { useSalesRows } from "@/features/sales/useSalesRows";

const when = (ms?: number) => (ms ? new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";

/** Past visits, filterable by location and date (Today | 7d | 28d | custom). */
export function HistoryScreen() {
  const shops = useShopLocations();
  const cloud = useChairRequests();
  const [range, setRange] = useState<SalesRange>("week");
  const deep = useSalesRows(range === "custom" ? 62 : 28, true);
  const [loc, setLoc] = useState("");
  const where = loc || (shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all");
  const fresh = new Map(cloud.rows.map((r) => [r.id, r]));
  const all = (deep ?? cloud.rows).map((r) => fresh.get(r.id) ?? r);
  const done = inRange(all, range, where).filter((row) => row.status === "done")
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
  const nameOf = (id?: string) => shops.branches.find((b) => b.id === (id || HOME_LOCATION_ID))?.name;
  const total = done.reduce((s2, r) => s2 + (r.price || 0), 0);
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="History" subtitle={deep || cloud.ready ? `${done.length} finished · ${peso(total)}` : "Loading"} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {shops.enabled && shops.branches.length > 1 ? (
          <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-pill bg-surface px-3 shadow-card">
            <MapPin size={14} className="flex-none text-muted" aria-hidden />
            <select aria-label="Location" value={where} onChange={(e) => setLoc(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[12.5px] font-bold outline-none">
              <option value="all">All locations</option>
              {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        ) : null}
        <RangeChips value={range} onChange={setRange} allowCustom />
      </div>
      {done.length ? <VisitList rows={done} placeOf={where === "all" && shops.enabled ? (r) => nameOf(r.locationId) : undefined} /> : (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished visits in this range.</p>
      )}
    </div>
  );
}

function VisitList({ rows, placeOf }: { rows: ChairRequest[]; placeOf?: (r: ChairRequest) => string | undefined }) {
  const [open, setOpen] = useState<ChairRequest | null>(null);
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {open ? <TransactionSheet row={rows.find((r) => r.id === open.id) ?? open} onClose={() => setOpen(null)} /> : null}
      {rows.map((row) => (
        <li key={row.id} role="button" tabIndex={0} aria-label={`View details for ${row.ref}`} onClick={() => setOpen(row)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(row); }} className="flex cursor-pointer items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card">
          <span className="min-w-0">
            <b className="block truncate">{row.customerLabel || row.contact}</b>
            <small className="text-[12.5px] font-semibold text-muted">{row.serviceName} · {row.ref}{placeOf?.(row) ? ` · ${placeOf(row)}` : ""} · {when(row.completedAt ?? row.updatedAt)}</small>
          </span>
          <span className="flex items-center gap-1.5"><b>{peso(row.price)}</b><ChevronRight size={18} strokeWidth={2} className="flex-none text-subtle" aria-hidden /></span>
        </li>
      ))}
    </ul>
  );
}
