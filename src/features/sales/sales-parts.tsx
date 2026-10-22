"use client";
import { Card, cn } from "@river-apps/ui";
import { CalendarDays, Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { peso } from "@/lib/format";
import { Spinner } from "@/components/common/button";
import { SALES_RANGES, setCustomRange, type SalesRange } from "@/lib/sales-report";
import type { BarberStat, ServiceStat } from "@/lib/sales-stats";
import type { Remit } from "./use-remit";
import { BarberPortrait } from "@/features/settings";
import { HOME_LOCATION_ID } from "@/lib/shop-locations";
import type { ShopChair } from "@/lib/shop-chairs";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
import { splitParts, type PaySplit } from "@/lib/pay-split";

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

const ymd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const short = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Compact date chips: Today | 7d | 28d | calendar (custom from–to, up to 62 days). */
export function RangeChips({ value, onChange, className, allowCustom = false }: { value: SalesRange; onChange: (v: SalesRange) => void; className?: string; allowCustom?: boolean }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => ymd(Date.now() - 13 * 86_400_000));
  const [to, setTo] = useState(() => ymd(Date.now()));
  const [today] = useState(() => ymd(Date.now()));
  const apply = (f: string, t: string) => { setCustomRange(f, t); onChange("custom"); };
  return (
    <div className={cn("relative inline-flex gap-1", className)}>
      <div role="radiogroup" aria-label="Date range" className="inline-flex gap-1">
        {SALES_RANGES.map((r) => (
          <button key={r.value} type="button" role="radio" aria-checked={value === r.value} onClick={() => { setOpen(false); onChange(r.value); }}
            className={cn("h-8 rounded-pill px-3 text-[12.5px] font-bold", value === r.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{r.label}</button>
        ))}
        {allowCustom ? (
          <button type="button" aria-pressed={value === "custom"} aria-label="Custom dates" aria-expanded={open} onClick={() => setOpen(!open)}
            className={cn("inline-flex h-8 items-center gap-1 rounded-pill px-2.5 text-[12.5px] font-bold", value === "custom" ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>
            <CalendarDays size={14} strokeWidth={2} />{value === "custom" ? `${short(from)}–${short(to)}` : null}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-[260px] rounded-[18px] bg-surface p-3 shadow-card ring-1 ring-line" role="dialog" aria-label="Custom dates">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-muted">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] bg-grey-100 px-2 text-[13px] font-semibold text-ink" /></label>
            <label className="text-[11px] font-bold text-muted">To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full rounded-[10px] bg-grey-100 px-2 text-[13px] font-semibold text-ink" /></label>
          </div>
          <button type="button" onClick={() => { apply(from, to); setOpen(false); }} className="mt-2.5 h-9 w-full rounded-pill bg-ink text-[13px] font-bold text-on-ink">Apply</button>
          <p className="mt-1.5 text-center text-[11px] font-semibold text-muted">Up to 62 days</p>
        </div>
      ) : null}
    </div>
  );
}

const href = (kind: "location" | "barber", id: string, range: SalesRange, loc?: string) =>
  `/sales/detail?kind=${kind}&id=${encodeURIComponent(id)}&r=${range}${loc ? `&loc=${encodeURIComponent(loc)}` : ""}`;

function Mini({ k, v }: { k: string; v: string }) {
  return <div className="rounded-[12px] bg-grey-100 px-1 py-2 text-center"><dt className="text-[10.5px] font-bold text-muted">{k}</dt><dd className="text-[13.5px] font-extrabold tabular-nums">{v}</dd></div>;
}

/** Barbers tab: ranked by sales, badge 1/2/3…, location under the name. Tap for the barber's page. */
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Total cash barbers hold that the owner hasn't marked received. Claim: one barber → claim now; several → sheet with a Claim per barber. */
export function UnclaimedCard({ remit, className, onClaim, claiming, locName }: { remit: Remit | null; className?: string; onClaim?: (barberId: string, locationId: string) => void; claiming?: string; locName?: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  const rows = remit?.unclaimed ?? [];
  const one = rows.length === 1 ? rows[0] : null;
  const busy = (u: { barberId: string; locationId: string }) => claiming === `${u.barberId}@${u.locationId}`;
  const own = (u: { amount: number; ownerShare?: number }) => u.ownerShare ?? u.amount;
  const ownerTotal = remit ? remit.ownerTotal ?? remit.total : 0;
  const line = remit && rows.length && ownerTotal !== remit.total ? `Total sales ${peso(remit.total)} · Barber ${peso(remit.total - ownerTotal)}` : null;
  return (
    <>
      <div className={cn("flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card", className)}>
        <span className="min-w-0"><b className="block text-[14px]">Unclaimed remit</b><small className="text-[12.5px] font-semibold text-muted">{remit ? (rows.length ? `${rows.reduce((s, u) => s + u.count, 0)} cash cuts · ${rows.length} barber${rows.length === 1 ? "" : "s"}` : "All cash received") : "Loading…"}</small>{line ? <small className="block text-[12px] font-semibold text-muted">{line}</small> : null}</span>
        <span className="flex flex-none items-center gap-2.5">
          <b className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums">{remit ? peso(ownerTotal) : "–"}</b>
          {onClaim && rows.length ? (
            <button type="button" data-auth="action" disabled={one ? busy(one) : false} onClick={() => (one ? onClaim(one.barberId, one.locationId) : setOpen(true))}
              className="inline-flex h-8 items-center rounded-pill bg-ink px-3.5 text-[12.5px] font-bold text-on-ink disabled:opacity-50">{one && busy(one) ? <span className="inline-flex items-center gap-1"><Spinner size={13} />Claiming…</span> : "Claim"}</button>
          ) : null}
        </span>
      </div>
      {open && onClaim ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Claim remit" className="w-full max-w-[480px] rounded-t-[24px] bg-surface px-4 pb-6 pt-4 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-grey-200" />
            <div className="flex items-center justify-between"><b className="text-[17px]">Claim remit</b><button type="button" onClick={() => setOpen(false)} className="text-[13px] font-bold text-muted">Done</button></div>
            {rows.length ? (
              <ul className="mt-3 grid grid-cols-1 [&>*]:min-w-0 gap-2">
                {rows.map((u) => (
                  <li key={`${u.barberId}@${u.locationId}`} className="flex items-center justify-between gap-3 rounded-[16px] bg-grey-100 px-3.5 py-3">
                    <span className="min-w-0">
                      <b className="block truncate text-[15px]">{u.barberName}</b>
                      <small className="block truncate text-[12px] font-semibold text-muted">{[locName?.(u.locationId), `${u.count} cash cut${u.count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</small>
                      {own(u) !== u.amount ? <small className="block truncate text-[12px] font-semibold text-ink-2">Total {peso(u.amount)} · Barber {peso(u.amount - own(u))}</small> : null}
                    </span>
                    <span className="flex flex-none items-center gap-2.5">
                      <b className="text-[15px] tabular-nums">{peso(own(u))}</b>
                      <button type="button" data-auth="action" disabled={busy(u)} onClick={() => onClaim(u.barberId, u.locationId)}
                        className="inline-flex h-8 items-center rounded-pill bg-ink px-3.5 text-[12.5px] font-bold text-on-ink disabled:opacity-50">{busy(u) ? <span className="inline-flex items-center gap-1"><Spinner size={13} />Claiming…</span> : "Claim"}</button>
                    </span>
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

/** Claimed remit history: date, barber, amount. Claimed cash stays counted in Sales and Collected. */
export function ClaimHistory({ remit, barberId, locationId, locName, className, max = 5 }: { remit: Remit | null; barberId?: string; locationId?: string; locName?: (id: string) => string; className?: string; max?: number }) {
  const [all, setAll] = useState(false);
  const rows = (remit?.claims ?? []).filter((c) => (!barberId || c.barberId === barberId) && (!locationId || c.locationId === locationId));
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, max);
  return (
    <section className={cn("mt-4", className)} aria-label="Claimed remit">
      <h2 className="px-1 text-[13px] font-bold text-muted">Claimed</h2>
      <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
        {shown.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14px]">{barberId ? `${c.count} cash cut${c.count === 1 ? "" : "s"}` : c.barberName}</b>
              <small className="flex min-w-0 items-center gap-1 text-[12px] font-semibold text-muted"><Check size={12} strokeWidth={3} className="flex-none" /><span className="min-w-0 truncate">Claimed by owner · {day(c.claimedAt)}</span></small>
              {!barberId && locName?.(c.locationId) ? <small className="block truncate text-[12px] font-semibold text-muted">{locName(c.locationId)}</small> : null}
              {(c.ownerShare ?? c.amount) !== c.amount ? <small className="block truncate text-[12px] font-semibold text-ink-2">Total {peso(c.amount)} · Barber {peso(c.amount - (c.ownerShare ?? c.amount))}</small> : null}
            </span>
            <b className="flex-none text-[14.5px] tabular-nums">{peso(c.ownerShare ?? c.amount)}</b>
          </li>
        ))}
      </ul>
      {rows.length > max ? <button type="button" onClick={() => setAll(!all)} className="mt-1.5 w-full py-1.5 text-center text-[12.5px] font-bold text-muted">{all ? "Show less" : `Show all ${rows.length}`}</button> : null}
    </section>
  );
}

export function BarberRanking({ rows, range, chairs = [], remit, onClaim, claiming }: { rows: BarberStat[]; range: SalesRange; chairs?: ShopChair[]; remit?: Remit | null; onClaim?: (barberId: string, locationId: string) => void; claiming?: string }) {
  if (!rows.length) return <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts in this range.</p>;
  const chairOf = (b: BarberStat) => chairs.find((c) => (c.barberId || c.id) === b.id && (c.locationId || HOME_LOCATION_ID) === b.locationId) ?? chairs.find((c) => (c.barberId || c.id) === b.id);
  return (
    <ol className="mt-4 grid grid-cols-1 [&>*]:min-w-0 gap-2.5 lg:grid-cols-2" aria-label="Barbers by sales">
      {rows.map((b) => (
        <li key={`${b.id}@${b.locationId}`}>
          <Link href={href("barber", b.id, range, b.locationId)} className={cn("box-border block w-full min-w-0 bg-surface px-4 py-3.5 shadow-card", onClaim ? "rounded-t-card" : "rounded-card")}>
            <div className="flex items-center gap-3">
              {/* Avatar, not a rank (Jimboy, 2026-10-20): ranking lives in My Barbers. Same portrait as there. */}
              {chairOf(b) ? <BarberPortrait chair={chairOf(b)!} size={40} /> : <span aria-hidden className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-grey-100 text-[14px] font-bold">{initials(b.name)}</span>}
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15.5px] underline decoration-grey-300 underline-offset-[3px]">{b.name}</b>
                {b.locationName ? <small className="block truncate text-[12.5px] font-semibold text-muted">{b.locationName}</small> : null}
                <small className="block truncate text-[12px] font-semibold text-muted">{[...splitParts(b).map((x) => `${x.label} ${peso(x.value)}`), `${b.cuts} cut${b.cuts === 1 ? "" : "s"}`, b.rating != null ? `★ ${b.rating.toFixed(1)} (${b.ratings})` : "No ratings"].join(" · ")}</small>
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
  if (!rows.length) return <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No cuts in this range.</p>;
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
        {open ? <><b className="text-[14px] tabular-nums">{peso(open.amount)}</b> <span className="text-muted">unclaimed · {open.count} cash cut{open.count === 1 ? "" : "s"}</span></> : <span className="text-muted">No unclaimed cash</span>}
        {last ? <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-bold text-muted"><Check size={12} strokeWidth={3} /> Claimed {peso(last.ownerShare ?? last.amount)} · {day(last.claimedAt)}</span> : null}
      </span>
      {open ? (
        <button type="button" data-auth="action" disabled={busy} onClick={() => onClaim(b.id, b.locationId)}
          className="inline-flex h-8 flex-none items-center rounded-pill bg-ink px-3.5 text-[12.5px] font-bold text-on-ink disabled:opacity-50">{busy ? <span className="inline-flex items-center gap-1"><Spinner size={13} />Claiming…</span> : "Claim"}</button>
      ) : last ? <span className="flex-none rounded-pill bg-grey-100 px-2.5 py-1 text-[11.5px] font-bold">Claimed</span> : null}
    </div>
  );
}
