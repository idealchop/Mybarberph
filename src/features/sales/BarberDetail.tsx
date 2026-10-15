"use client";
import { cn } from "@river-apps/ui";
import { Star } from "lucide-react";
import { useMemo } from "react";
import type { ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import type { SalesRange } from "@/lib/sales-report";
import { barberKey, dailySeries, inRange } from "@/lib/sales-stats";
import type { ShopChair } from "@/lib/shop-chairs";
import { BarberPortrait } from "@/features/settings/SeatList";
import { SalesChartCard } from "./SalesChart";
import { ClaimHistory } from "./SalesParts";
import { PerformanceDashboard } from "./PerformanceDashboard";
import type { Remit } from "./useRemit";

const MEDAL = ["🥇", "🥈", "🥉"];

/** Owner-side barber page: rank, productivity, remit, sales over time, then the full performance dashboard scoped to this barber. */
export function BarberDetail({ id, all, range, chairs, branches, remit }: { id: string; all: ChairRequest[]; range: SalesRange; chairs: ShopChair[]; branches: { id: string; name: string }[]; remit: Remit | null }) {
  const mine = useMemo(() => all.filter((r) => barberKey(r, chairs) === id), [all, chairs, id]);
  const chair = chairs.find((c) => (c.barberId || c.id) === id);
  const cur = inRange(mine, range, "all").filter((r) => r.status === "done");

  // Rank among every barber by sales in this range.
  const ranking = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of chairs) if (c.active !== false) m.set(c.barberId || c.id, 0);
    for (const r of inRange(all, range, "all")) if (r.status === "done") { const k = barberKey(r, chairs); if (!k.startsWith("seat:")) m.set(k, (m.get(k) ?? 0) + (r.price || 0)); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all, chairs, range]);
  const rank = ranking.findIndex(([k]) => k === id);

  const minutes = cur.filter((r) => r.startedAt && r.completedAt && r.completedAt > r.startedAt).map((r) => (r.completedAt! - r.startedAt!) / 60_000).filter((m) => m < 300);
  const busy = minutes.reduce((a, b) => a + b, 0);
  const perHour = busy > 0 ? Math.round((minutes.length / (busy / 60)) * 10) / 10 : null;

  const toClaim = (remit?.unclaimed ?? []).filter((u) => u.barberId === id).reduce((s, u) => s + u.amount, 0);
  const claimed = (remit?.claims ?? []).filter((c) => c.barberId === id).reduce((s, c) => s + c.amount, 0);

  const rated = cur.filter((r) => typeof r.rating === "number" && r.rating > 0);
  const avgRating = rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length) * 10) / 10 : null;
  const comments = mine.filter((r) => r.feedback?.trim()).sort((a, b) => (b.feedbackAt ?? 0) - (a.feedbackAt ?? 0)).slice(0, 5);

  const series = dailySeries(all, range, "all", (r) => barberKey(r, chairs) === id).map((d) => ({ label: d.label, orders: d.cuts, salesCentavos: d.sales, detail: `${d.cuts} cuts` }));
  const sales = cur.reduce((s, r) => s + (r.price || 0), 0);

  return (
    <>
      <section className="mt-4 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
        {chair ? <BarberPortrait chair={chair} size={52} /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-muted">Rank among {ranking.length} barber{ranking.length === 1 ? "" : "s"}</p>
          <b className="flex items-center gap-1.5 text-[22px] tracking-[-0.02em]">{rank >= 0 && rank < 3 && sales > 0 ? <span className="text-[24px]">{MEDAL[rank]}</span> : null}#{rank >= 0 ? rank + 1 : "–"}</b>
        </div>
        {avgRating != null ? (
          <div className="text-right">
            <p className="text-[12px] font-semibold text-muted">Rating</p>
            <b className="inline-flex items-center gap-1 text-[18px]"><Star size={16} className="fill-[#F5B800] text-[#F5B800]" aria-hidden />{avgRating}</b>
            <small className="block text-[11px] font-semibold text-muted">{rated.length} review{rated.length === 1 ? "" : "s"}</small>
          </div>
        ) : null}
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2 [&>*]:min-w-0">
        <Mini k="Cuts / hour" v={perHour == null ? "–" : String(perHour)} />
        <Mini k="To claim" v={remit ? peso(toClaim) : "–"} tone={toClaim > 0 ? "warn" : undefined} />
        <Mini k="Claimed" v={remit ? peso(claimed) : "–"} />
      </div>

      {range !== "today" ? <SalesChartCard className="mt-3" series={series} kind="day" sales={sales} /> : null}

      <PerformanceDashboard solo all={mine} range={range} where="all" branches={branches} chairs={chairs} />

      {comments.length ? (
        <section className="mt-3 rounded-card bg-surface px-4 py-4 shadow-card">
          <h2 className="text-[16px] font-bold">Customer feedback</h2>
          <ul className="mt-2 grid gap-2">
            {comments.map((r) => (
              <li key={r.id} className="rounded-[14px] bg-grey-100 px-3 py-2.5">
                <span className="text-[12px] font-bold">{"★".repeat(Math.round(r.rating || 0))}<span className="text-grey-300">{"★".repeat(5 - Math.round(r.rating || 0))}</span></span>
                <p className="text-[13.5px] font-semibold">{r.feedback}</p>
                <small className="text-[11.5px] font-semibold text-muted">{r.customerLabel || "Customer"} · {r.serviceName}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ClaimHistory remit={remit} barberId={id} max={10} />
    </>
  );
}

function Mini({ k, v, tone }: { k: string; v: string; tone?: "warn" }) {
  return (
    <div className="rounded-card bg-surface px-3 py-2.5 shadow-card">
      <p className="truncate text-[11.5px] font-semibold text-muted">{k}</p>
      <b className={cn("block truncate text-[16px] tabular-nums", tone === "warn" && "text-[#B54708]")}>{v}</b>
    </div>
  );
}
