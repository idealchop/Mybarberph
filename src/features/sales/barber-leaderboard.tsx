"use client";
import { ListSkeleton } from "@/components/common/skeleton";
import { cn } from "@river-apps/ui";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageBack } from "@/components/shell/page-back";
import { BarberPortrait } from "@/features/settings";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { rangeFetchDays, type SalesRange } from "@/lib/sales-report";
import { barberKey, inRange } from "@/lib/sales-stats";
import { chairBarberName, useShopChairs, type ShopChair } from "@/lib/shop-chairs";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { RangeChips } from "./sales-parts";
import { useSalesRows } from "./use-sales-rows";

type Sort = "sales" | "productivity" | "completion" | "speed" | "cuts";
const SORTS: [Sort, string][] = [["sales", "Sales"], ["productivity", "Productivity"], ["completion", "Completion"], ["speed", "Fastest"], ["cuts", "Cuts"]];
const MEDAL = ["🥇", "🥈", "🥉"];

interface Row { key: string; id: string; loc: string; locName: string; name: string; chair?: ShopChair; sales: number; cuts: number; declined: number; completion: number | null; avgMin: number | null; perHour: number | null }

/** Sales → My Barbers: leaderboard of every barber with sortable metrics. */
export function BarberLeaderboard() {
  const shops = useShopLocations();
  const { chairs } = useShopChairs({ all: true });
  const [range, setRange] = useState<SalesRange>("week");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("sales");
  const [page, setPage] = useState(0);
  const deep = useSalesRows(rangeFetchDays(range));
  const cloud = useChairRequests();
  const all = deep ?? cloud.rows;
  const where = "all"; // Leaderboard always ranks every location.
  const locName = (id: string) => (shops.enabled ? shops.branches.find((b) => b.id === id)?.name ?? "" : "");

  const rows = useMemo(() => {
    const map = new Map<string, Row & { mins: number[] }>();
    const blank = (id: string, l: string, name: string, chair?: ShopChair) => ({ key: `${id}@${l}`, id, loc: l, locName: locName(l), name, chair, sales: 0, cuts: 0, declined: 0, completion: null, avgMin: null, perHour: null, mins: [] as number[] });
    for (const c of chairs) {
      if (c.active === false) continue;
      const l = c.locationId || HOME_LOCATION_ID;
      if (where !== "all" && l !== where) continue;
      const id = c.barberId || c.id;
      map.set(`${id}@${l}`, blank(id, l, chairBarberName(c), c));
    }
    for (const r of inRange(all, range, where)) {
      if (r.status !== "done" && r.status !== "declined") continue;
      const id = barberKey(r, chairs);
      if (id.startsWith("seat:")) continue;
      const l = r.locationId || HOME_LOCATION_ID, k = `${id}@${l}`;
      const chair = chairs.find((c) => (c.barberId || c.id) === id);
      if (chair?.active === false) continue;
      const x = map.get(k) ?? blank(id, l, r.barberName || (chair ? chairBarberName(chair) : "Barber"), chair);
      if (r.status === "declined") x.declined += 1;
      else {
        x.cuts += 1; x.sales += r.price || 0;
        if (r.startedAt && r.completedAt && r.completedAt > r.startedAt) { const m = (r.completedAt - r.startedAt) / 60_000; if (m < 300) x.mins.push(m); }
      }
      map.set(k, x);
    }
    return [...map.values()].map(({ mins, ...x }) => {
      const total = mins.reduce((a, b) => a + b, 0);
      return { ...x, completion: x.cuts + x.declined ? Math.round((x.cuts / (x.cuts + x.declined)) * 100) : null, avgMin: mins.length ? Math.round(total / mins.length) : null, perHour: total > 0 ? Math.round((mins.length / (total / 60)) * 10) / 10 : null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, chairs, range, where, shops.branches]);

  const val = (r: Row): number => sort === "sales" ? r.sales : sort === "cuts" ? r.cuts : sort === "completion" ? (r.completion ?? -1) : sort === "productivity" ? (r.perHour ?? -1) : (r.avgMin == null ? -Infinity : -r.avgMin);
  const needle = q.trim().toLowerCase();
  const sorted = [...rows].filter((r) => !needle || r.name.toLowerCase().includes(needle)).sort((a, b) => val(b) - val(a) || b.sales - a.sales || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(sorted.length / 10));
  const p = Math.min(page, pages - 1);
  const shown = sorted.slice(p * 10, p * 10 + 10);
  const hasScore = (r: Row) => val(r) > 0 || (sort === "speed" && r.avgMin != null);

  const shownVal = (r: Row) => sort === "cuts" ? `${r.cuts} cut${r.cuts === 1 ? "" : "s"}` : sort === "completion" ? (r.completion == null ? "–" : `${r.completion}%`) : sort === "productivity" ? (r.perHour == null ? "–" : `${r.perHour}/hr`) : sort === "speed" ? (r.avgMin == null ? "–" : `${r.avgMin} min/cut`) : peso(r.sales);

  if (!deep && !cloud.ready) return <ListSkeleton />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-10 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/sales" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">My Barbers</h1>
      </div>
      <label className="mt-3 flex h-10 items-center gap-2 rounded-pill bg-surface px-3.5 shadow-card">
        <Search size={16} className="flex-none text-muted" aria-hidden />
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search barber" aria-label="Search barber by name" className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder:text-muted" />
      </label>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <RangeChips value={range} onChange={(v) => { setRange(v); setPage(0); }} allowCustom />
      </div>
      <div role="radiogroup" aria-label="Rank by" className="mt-2.5 grid grid-cols-5 gap-1">
        {SORTS.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => { setSort(v); setPage(0); }}
            className={cn("h-8 min-w-0 truncate rounded-pill px-1 text-[12px] font-bold", sort === v ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{l}</button>
        ))}
      </div>

      {!sorted.length && needle ? <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No barber named “{q.trim()}”.</p> : !sorted.length ? (
        <div className="mt-4 rounded-card bg-surface px-6 py-10 text-center shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons3d/bar-chart.png" alt="" width={52} height={52} className="mx-auto size-[52px] object-contain" />
          <b className="mt-2 block text-[15px]">No barbers yet</b>
          <p className="mt-1 text-[13px] font-semibold text-muted">Add barbers in Manage Shop. Their sales and speed rank here.</p>
        </div>
      ) : (
        <ol className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          {shown.map((r, j) => {
            const i = p * 10 + j;
            return (
              <li key={r.key} className="border-b border-line last:border-b-0">
                <Link href={`/sales/detail?kind=barber&id=${encodeURIComponent(r.id)}&r=${range}&loc=${encodeURIComponent(r.loc)}`} className="flex items-center gap-3 px-3.5 py-3">
                  <span className={cn("inline-flex size-7 flex-none items-center justify-center rounded-full font-extrabold", i < 3 && hasScore(r) ? "text-[19px]" : "bg-grey-100 text-[12.5px] text-muted")} aria-label={`Rank ${i + 1}`}>{i < 3 && hasScore(r) ? MEDAL[i] : i + 1}</span>
                  {r.chair ? <BarberPortrait chair={r.chair} size={40} /> : <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-grey-100 text-[14px] font-bold">{r.name.slice(0, 1)}</span>}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{r.name}</b>
                    <small className="block truncate text-[12px] font-semibold text-muted">{[r.locName, `${r.cuts} cut${r.cuts === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="flex-none text-right"><b className="block text-[15px] tabular-nums">{shownVal(r)}</b></span>
                  <ChevronRight size={17} className="flex-none text-subtle" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-between px-1 text-[13px] font-bold">
          <button type="button" disabled={p === 0} onClick={() => setPage(p - 1)} className="disabled:opacity-30">‹ Prev</button>
          <span className="text-[12px] text-muted">{p * 10 + 1}–{Math.min(sorted.length, p * 10 + 10)} of {sorted.length}</span>
          <button type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="disabled:opacity-30">Next ›</button>
        </div>
      ) : null}
    </div>
  );
}

