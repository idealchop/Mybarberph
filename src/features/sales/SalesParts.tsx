"use client";
import { Card, cn } from "@river-apps/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { peso } from "@/lib/format";
import { SALES_RANGES, type SalesRange } from "@/lib/sales-report";
import type { BarberStat, LocStat, ServiceStat } from "@/lib/sales-stats";

const pct = (v: number | null) => (v == null ? "–" : `${v}%`);

/** Compact date chips: Today | 7d | 28d. */
export function RangeChips({ value, onChange, className }: { value: SalesRange; onChange: (v: SalesRange) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Date range" className={cn("inline-flex gap-1", className)}>
      {SALES_RANGES.map((r) => (
        <button key={r.value} type="button" role="radio" aria-checked={value === r.value} onClick={() => onChange(r.value)}
          className={cn("h-8 rounded-pill px-3 text-[12.5px] font-bold", value === r.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{r.label}</button>
      ))}
    </div>
  );
}

const href = (kind: "location" | "barber", id: string, range: SalesRange, loc?: string) =>
  `/sales/detail?kind=${kind}&id=${encodeURIComponent(id)}&r=${range}${loc ? `&loc=${encodeURIComponent(loc)}` : ""}`;

function Mini({ k, v }: { k: string; v: string }) {
  return <div className="rounded-[12px] bg-grey-100 px-1 py-2 text-center"><dt className="text-[10.5px] font-bold text-muted">{k}</dt><dd className="text-[13.5px] font-extrabold tabular-nums">{v}</dd></div>;
}

/** Overview · All locations: one performance card per shop. Tap for that shop's page. */
export function LocationCards({ rows, range }: { rows: LocStat[]; range: SalesRange }) {
  return (
    <section className="mt-4" aria-label="Per location">
      <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Per location</h2>
      <ul className="mt-2 grid gap-2.5 lg:grid-cols-2">
        {rows.map((l) => (
          <li key={l.id}>
            <Link href={href("location", l.id, range)} className="block rounded-card bg-surface px-4 py-3.5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <b className="truncate text-[15.5px] underline decoration-grey-300 underline-offset-[3px]">{l.name}</b>
                <span className="flex items-center gap-1"><b className="text-[16px] tabular-nums">{peso(l.sales)}</b><ChevronRight size={17} className="text-subtle" aria-hidden /></span>
              </div>
              <dl className="mt-2.5 grid grid-cols-3 gap-2">
                <Mini k="Cuts" v={String(l.cuts)} /><Mini k="Avg ticket" v={peso(l.avg)} /><Mini k="Completion" v={pct(l.completionPct)} />
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Barbers tab: ranked by sales, badge 1/2/3…, location under the name. Tap for the barber's page. */
export function BarberRanking({ rows, range, showLoc }: { rows: BarberStat[]; range: SalesRange; showLoc: boolean }) {
  if (!rows.length) return <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished cuts in this range.</p>;
  return (
    <ol className="mt-4 grid gap-2.5 lg:grid-cols-2" aria-label="Barber ranking by sales">
      {rows.map((b, i) => (
        <li key={`${b.id}@${b.locationId}`}>
          <Link href={href("barber", b.id, range, b.locationId)} className="block rounded-card bg-surface px-4 py-3.5 shadow-card">
            <div className="flex items-center gap-3">
              <span className={cn("inline-flex size-8 flex-none items-center justify-center rounded-full text-[13.5px] font-extrabold", i === 0 ? "bg-ink text-on-ink" : i < 3 ? "bg-grey-200" : "bg-grey-100 text-muted")} aria-label={`Rank ${i + 1}`}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15.5px] underline decoration-grey-300 underline-offset-[3px]">{b.name}</b>
                <small className="block truncate text-[12.5px] font-semibold text-muted">{showLoc ? b.locationName : `${b.cuts} cut${b.cuts === 1 ? "" : "s"}`}</small>
              </span>
              <b className="text-[16px] tabular-nums">{peso(b.sales)}</b>
              <ChevronRight size={17} className="flex-none text-subtle" aria-hidden />
            </div>
            <dl className="mt-2.5 grid grid-cols-4 gap-1.5">
              <Mini k="Cuts" v={String(b.cuts)} /><Mini k="Cash" v={peso(b.cash)} /><Mini k="GCash" v={peso(b.gcash)} /><Mini k="Remit" v={peso(b.remit)} />
            </dl>
          </Link>
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
    <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
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
