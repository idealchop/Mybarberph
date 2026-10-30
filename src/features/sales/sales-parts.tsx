"use client";
import { Card, cn } from "@river-apps/ui";
import { Check, ChevronRight, UserRound } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { peso } from "@/lib/format";
import { Button } from "@/components/common/button";
import { type SalesRange } from "@/lib/sales-report";
import { RangeChips } from "./range-chips";
import type { BarberStat, ServiceStat } from "@/lib/sales-stats";
import type { Remit } from "./use-remit";
import { BarberPortrait } from "@/features/settings/seat-list";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import type { ShopChair } from "@/lib/shop-chairs";
import { splitParts, type PaySplit } from "@/lib/pay-split";

export { RangeChips };


/** Collected money by payment method. "lines": one row per method (stat cards); "inline": "Cash ₱X · GCash ₱Y". */
export function PaySplitText({ split, layout = "inline", className }: { split: PaySplit; layout?: "lines" | "inline"; className?: string }) {
  const parts = splitParts(split);
  if (layout === "inline") return <span className={className}>{parts.map((p) => `${p.label} ${peso(p.value)}`).join(" · ")}</span>;
  return (
    <span className={cn("mt-0.5 flex flex-col gap-0.5", className)} aria-label="Collected by payment method">
      {parts.map((p) => <span key={p.key} className="flex items-baseline justify-between gap-2"><span>{p.label}</span><b className="font-bold tabular-nums text-ink">{peso(p.value)}</b></span>)}
    </span>
  );
}

const pct = (v: number | null) => (v == null ? "–" : `${v}%`);

const href = (kind: "location" | "barber", id: string, range: SalesRange, loc?: string) =>
  `/sales/detail?kind=${kind}&id=${encodeURIComponent(id)}&r=${range}${loc ? `&loc=${encodeURIComponent(loc)}` : ""}`;

function Mini({ k, v }: { k: string; v: string }) {
  return <div className="rounded-[12px] bg-grey-100 px-1 py-2 text-center"><dt className="text-[10.5px] font-bold text-muted">{k}</dt><dd className="text-[13.5px] font-extrabold tabular-nums">{v}</dd></div>;
}

/** Barbers tab: ranked by sales, badge 1/2/3…, location under the name. Tap for the barber's page. */
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

function Initial(_p: { name: string }) {
  return <span aria-hidden className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-grey-100 text-muted"><UserRound size={20} aria-hidden /></span>;
}
function ClaimBtn({ busy, onClick }: { busy?: boolean; onClick: () => void }) {
  return (
    <Button data-auth="action" size="sm" pill className="flex-none px-5" loading={busy} onClick={onClick}>Claim</Button>
  );
}

/** Collected + Uncollected, balanced: same height, value on top, detail below. */
export function CollectionCards({ collected, split, shopShare, unpaid, className }: { collected: number; split: PaySplit; shopShare?: number | null; unpaid: number; className?: string }) {
  const parts = splitParts(split);
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <section aria-label="Collected" className="flex flex-col rounded-card bg-surface px-4 py-3.5 shadow-card">
        <span className="text-[12.5px] font-semibold text-muted">Collected</span>
        <b className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums">{peso(collected)}</b>
        <span className="mt-2 flex flex-col gap-0.5 text-[12.5px] font-semibold text-muted">
          {parts.length ? parts.map((p) => <span key={p.key} className="flex justify-between gap-2"><span>{p.label}</span><b className="tabular-nums text-ink">{peso(p.value)}</b></span>) : <span>No payments yet</span>}
        </span>
        {shopShare != null ? <span className="mt-auto flex justify-between gap-2 border-t border-line pt-2 text-[12.5px] font-semibold text-muted"><span>Your share</span><b className="tabular-nums text-ink">{peso(shopShare)}</b></span> : null}
      </section>
      <section aria-label="Uncollected" className="flex flex-col rounded-card bg-surface px-4 py-3.5 shadow-card">
        <span className="text-[12.5px] font-semibold text-muted">Uncollected</span>
        <b className={cn("mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums", !unpaid && "text-muted")}>{peso(unpaid)}</b>
        <span className="mt-auto flex items-center gap-2 pt-3">
          <span aria-hidden className={cn("inline-flex size-7 items-center justify-center rounded-full", unpaid ? "bg-[#FFF4D6] text-[#8A5A00]" : "bg-[#E7F6EC] text-[#0B7A3E]")}>{unpaid ? "!" : <Check size={14} strokeWidth={3} />}</span>
          <span className="text-[12.5px] font-semibold text-muted">{unpaid ? "Still unpaid" : "All paid"}</span>
        </span>
      </section>
    </div>
  );
}

/** Unclaimed remit: hero = your (owner) share of barbers' cash, Claim beside it; total + barbers' part as chips. */
export function UnclaimedCard({ remit, className, onClaim, claiming, locName }: { remit: Remit | null; className?: string; onClaim?: (barberId: string, locationId: string) => void; claiming?: string; locName?: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  const rows = remit?.unclaimed ?? [];
  const one = rows.length === 1 ? rows[0] : null;
  const busy = (u: { barberId: string; locationId: string }) => claiming === `${u.barberId}@${u.locationId}`;
  const own = (u: { amount: number; ownerShare?: number }) => u.ownerShare ?? u.amount;
  const ownerTotal = remit ? remit.ownerTotal ?? remit.total : 0;
  const cuts = rows.reduce((s, u) => s + u.count, 0);
  return (
    <>
      <section aria-label="Unclaimed remit" className={cn("rounded-card bg-surface px-4 py-4 shadow-card", className)}>
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Unclaimed remit</span>
            <span className="block text-[12px] font-semibold text-muted">{remit ? (rows.length ? `${cuts} cash haircut${cuts === 1 ? "" : "s"} · ${rows.length} barber${rows.length === 1 ? "" : "s"}` : "All cash received") : "Loading…"}</span>
          </span>
          {onClaim && rows.length ? <ClaimBtn busy={one ? busy(one) : false} onClick={() => (one ? onClaim(one.barberId, one.locationId) : setOpen(true))} /> : null}
        </div>
        <span className="mt-3 block text-[12.5px] font-semibold text-muted">Your share</span>
        <b className={cn("block text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums", remit && !ownerTotal && "text-muted")}>{remit ? peso(ownerTotal) : "–"}</b>
      </section>
      {open && onClaim ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Claim remit" className="w-full max-w-[480px] rounded-t-[24px] bg-surface px-4 pb-6 pt-4 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-grey-200" />
            <div className="flex items-center justify-between"><b className="text-[18px]">Claim remit</b><button type="button" onClick={() => setOpen(false)} className="text-[13.5px] font-bold text-muted">Done</button></div>
            <p className="mt-0.5 text-[12.5px] font-semibold text-muted">You claim your share of each barber’s cash.</p>
            {rows.length ? (
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[18px] border border-line">
                {rows.map((u) => (
                  <li key={`${u.barberId}@${u.locationId}`} className="flex items-center gap-3 px-3.5 py-3">
                    <Initial name={u.barberName} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px]">{u.barberName}</b>
                      <small className="block truncate text-[12px] font-semibold text-muted">{[locName?.(u.locationId), `${u.count} cash haircut${u.count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="flex-none text-right"><b className="block text-[16px] tabular-nums">{peso(own(u))}</b></span>
                    <ClaimBtn busy={busy(u)} onClick={() => onClaim(u.barberId, u.locationId)} />
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-center text-[13.5px] font-semibold text-muted">All cash received.</p>}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Claimed remit history: who, where, when; right = your share claimed, "of ₱X total". */
export function ClaimHistory({ remit, barberId, locationId, locName, className, max = 5 }: { remit: Remit | null; barberId?: string; locationId?: string; locName?: (id: string) => string; className?: string; max?: number }) {
  const [all, setAll] = useState(false);
  const rows = (remit?.claims ?? []).filter((c) => (!barberId || c.barberId === barberId) && (!locationId || c.locationId === locationId));
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, max);
  return (
    <section className={cn("mt-5", className)} aria-label="Claimed remit">
      <h2 className="px-1 text-[15px] font-bold">Claimed</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
        {shown.map((c) => {
          const share = c.ownerShare ?? c.amount;
          const who = barberId ? `${c.count} cash haircut${c.count === 1 ? "" : "s"}` : c.barberName;
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Initial name={barberId ? "₱" : c.barberName} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14.5px]">{who}</b>
                <small className="flex min-w-0 items-center gap-1 text-[12px] font-semibold text-muted"><Check size={12} strokeWidth={3} className="flex-none text-[#0B7A3E]" /><span className="min-w-0 truncate">{[!barberId ? locName?.(c.locationId) : "", day(c.claimedAt)].filter(Boolean).join(" · ")}</span></small>
              </span>
              <span className="flex-none text-right"><b className="block text-[15.5px] tabular-nums">{peso(share)}</b></span>
            </li>
          );
        })}
      </ul>
      {rows.length > max ? <button type="button" onClick={() => setAll(!all)} className="mt-1.5 w-full py-1.5 text-center text-[12.5px] font-bold text-muted">{all ? "Show less" : `Show all ${rows.length}`}</button> : null}
    </section>
  );
}

export function BarberRanking({ rows, range, chairs = [], remit, onClaim, claiming }: { rows: BarberStat[]; range: SalesRange; chairs?: ShopChair[]; remit?: Remit | null; onClaim?: (barberId: string, locationId: string) => void; claiming?: string }) {
  if (!rows.length) return <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished haircuts in this range.</p>;
  const chairOf = (b: BarberStat) => chairs.find((c) => (c.barberId || c.id) === b.id && (c.locationId || HOME_LOCATION_ID) === b.locationId) ?? chairs.find((c) => (c.barberId || c.id) === b.id);
  return (
    <ol className="mt-4 grid grid-cols-1 [&>*]:min-w-0 gap-2.5 lg:grid-cols-2" aria-label="Barbers by sales">
      {rows.map((b) => (
        <li key={`${b.id}@${b.locationId}`}>
          <Link href={href("barber", b.id, range, b.locationId)} className={cn("box-border block w-full min-w-0 bg-surface px-4 py-3.5 shadow-card", onClaim ? "rounded-t-card" : "rounded-card")}>
            <div className="flex items-center gap-3">
              {/* Avatar, not a rank (Jimboy, 2026-10-20): ranking lives in My Barbers. Same portrait as there. */}
              {chairOf(b) ? <BarberPortrait chair={chairOf(b)!} size={40} /> : <span aria-hidden className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-grey-100 text-muted"><UserRound size={20} aria-hidden /></span>}
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15.5px] underline decoration-grey-300 underline-offset-[3px]">{b.name}</b>
                {b.locationName ? <small className="block truncate text-[12.5px] font-semibold text-muted">{b.locationName}</small> : null}
                <small className="block truncate text-[12px] font-semibold text-muted">{[...splitParts(b).map((x) => `${x.label} ${peso(x.value)}`), `${b.cuts} haircut${b.cuts === 1 ? "" : "s"}`, b.rating != null ? `★ ${b.rating.toFixed(1)} (${b.ratings})` : "No ratings"].join(" · ")}</small>
              </span>
              <b className="flex-none text-[16px] tabular-nums">{peso(b.sales)}</b>
              <ChevronRight size={17} className="flex-none text-subtle" aria-hidden />
            </div>
          </Link>
          {onClaim ? <ClaimRow b={b} remit={remit ?? null} onClaim={onClaim} busy={claiming === `${b.id}@${b.locationId}`} /> : null}
        </li>
      ))}
    </ol>
  );
}

/** Services tab: volume, revenue, avg ticket and completion per service. */
export function ServiceTable({ rows, split }: { rows: ServiceStat[]; split?: { loc: string; rows: ServiceStat[] }[] }) {
  if (!rows.length) return <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No haircuts in this range.</p>;
  const total = rows.reduce((s, r) => s + r.sales, 0) || 1;
  return (
    <ul className="mt-4 grid grid-cols-1 [&>*]:min-w-0 gap-2.5 lg:grid-cols-2">
      {rows.map((s) => (
        <li key={s.name}>
          <Card className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <b className="truncate text-[15px]">{s.name}</b>
              <b className="text-[16px] tabular-nums">{peso(s.sales)}</b>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-grey-100"><div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(3, Math.round((s.sales / total) * 100))}%` }} /></div>
            <dl className="mt-2.5 grid grid-cols-3 gap-2"><Mini k="Volume" v={String(s.cuts)} /><Mini k="Avg ticket" v={peso(s.avg)} /><Mini k="Completion" v={pct(s.completionPct)} /></dl>
            {split ? (
              <p className="mt-2 text-[12px] font-semibold text-muted">
                {split.map((x) => { const r = x.rows.find((y) => y.name === s.name); return r ? `${x.loc}: ${r.cuts} · ${peso(r.sales)}` : null; }).filter(Boolean).join("  ·  ")}
              </p>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Under a barber card (single location): unclaimed cash with a Claim button, or the last claim badge. */
function ClaimRow({ b, remit, onClaim, busy }: { b: BarberStat; remit: Remit | null; onClaim: (barberId: string, locationId: string) => void; busy: boolean }) {
  const open = remit?.unclaimed.find((u) => u.barberId === b.id && u.locationId === b.locationId);
  const last = remit?.claims.find((c) => c.barberId === b.id && c.locationId === b.locationId);
  return (
    <div className="flex items-center justify-between gap-3 rounded-b-card border-t border-dashed border-line bg-surface px-4 py-2.5 shadow-card">
      <span className="min-w-0 text-[12.5px] font-semibold">
        {open ? <><b className="text-[14px] tabular-nums">{peso(open.ownerShare ?? open.amount)}</b> <span className="text-muted">your share unclaimed · {open.count} cash haircut{open.count === 1 ? "" : "s"}</span></> : <span className="text-muted">No unclaimed cash</span>}
        {last ? <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-bold text-muted"><Check size={12} strokeWidth={3} /> Claimed {peso(last.ownerShare ?? last.amount)} · {day(last.claimedAt)}</span> : null}
      </span>
      {open ? (
        <Button data-auth="action" size="sm" pill className="flex-none" loading={busy} onClick={() => onClaim(b.id, b.locationId)}>Claim</Button>
      ) : last ? <span className="flex-none rounded-pill bg-grey-100 px-2.5 py-1 text-[11.5px] font-bold">Claimed</span> : null}
    </div>
  );
}
