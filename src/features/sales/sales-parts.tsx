"use client";
import { Card, cn } from "@river-apps/ui";
import { Check, UserRound } from "lucide-react";
import { useState } from "react";
import { peso } from "@/lib/format";
import { RangeChips } from "./range-chips";
import type { ServiceStat } from "@/lib/sales-stats";
import type { Remit } from "./use-remit";
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

function Mini({ k, v }: { k: string; v: string }) {
  return <div className="rounded-[12px] bg-grey-100 px-1 py-2 text-center"><dt className="text-[10.5px] font-bold text-muted">{k}</dt><dd className="text-[13.5px] font-extrabold tabular-nums">{v}</dd></div>;
}

const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
function Initial(_p: { name: string }) {
  return <span aria-hidden className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-grey-100 text-muted"><UserRound size={20} aria-hidden /></span>;
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
