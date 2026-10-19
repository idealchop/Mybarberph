"use client";
import { cn } from "@river-apps/ui";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { saveChair, chairBarberName, resetChairLink } from "@/lib/shop-chairs";
import type { ChairRequest } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import type { SalesRange } from "@/lib/sales-report";
import { barberKey, dailySeries, inRange } from "@/lib/sales-stats";
import type { ShopChair } from "@/lib/shop-chairs";
import { BarberPortrait, LinkReviewList, ShareBarberLink } from "@/features/settings";
import { SalesChartCard } from "./sales-chart";
import { ClaimHistory } from "./sales-parts";
import { PerformanceDashboard } from "./performance-dashboard";
import type { Remit } from "./use-remit";

const MEDAL = ["🥇", "🥈", "🥉"];

/** Owner-side barber page: rank, productivity, remit, sales over time, then the full performance dashboard scoped to this barber. */
export function BarberDetail({ id, all, range, chairs, branches, remit }: { id: string; all: ChairRequest[]; range: SalesRange; chairs: ShopChair[]; branches: { id: string; name: string }[]; remit: Remit | null }) {
  const mine = useMemo(() => all.filter((r) => barberKey(r, chairs) === id), [all, chairs, id]);
  const chair = chairs.find((c) => (c.barberId || c.id) === id);
  const [ask, setAsk] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [wasReset, setWasReset] = useState(false);
  const [err, setErr] = useState("");
  const off = chair?.active === false;
  const setActive = (on: boolean) => { if (!chair) return; const e = saveChair({ ...chair, active: on }); setErr(e || ""); setAsk(false); };
  const cur = inRange(mine, range, "all").filter((r) => r.status === "done");

  // Rank among every barber by sales in this range.
  const ranking = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of chairs) if (c.active !== false) m.set(c.barberId || c.id, 0);
    for (const r of inRange(all, range, "all")) if (r.status === "done") { const k = barberKey(r, chairs); if (!k.startsWith("seat:") && !chairs.some((c) => (c.barberId || c.id) === k && c.active === false)) m.set(k, (m.get(k) ?? 0) + (r.price || 0)); }
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
      {chair ? (
        <section className="mt-4 flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
          <span className="min-w-0">
            <b className="block text-[15px]">{off ? "Inactive" : "Active"}</b>
            <small className="block text-[12.5px] font-semibold text-muted">{off ? "Link turned off · hidden from rankings" : "Barber link works · shows in rankings"}</small>
          </span>
          <button type="button" role="switch" aria-checked={!off} aria-label="Active" data-auth="action" onClick={() => (off ? setActive(true) : setAsk(true))}
            className={cn("relative h-7 w-12 flex-none rounded-full transition", off ? "bg-grey-300" : "bg-ink")}>
            <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", off ? "left-0.5" : "left-[22px]")} />
          </button>
        </section>
      ) : null}
      {chair && !off ? (
        <section className="mt-2 flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
          <span className="min-w-0">
            <b className="block text-[15px]">Barber link</b>
            <small className="block text-[12.5px] font-semibold text-muted">{wasReset ? "New link ready. Send it to the barber." : "Never expires. Reset it if it was shared by mistake."}</small>
          </span>
          {wasReset ? <ShareBarberLink compact id={chair.id} name={chairBarberName(chair)} /> : (
            <button type="button" data-auth="action" onClick={() => setAskReset(true)} className="inline-flex h-7 flex-none items-center rounded-pill px-3 text-[12px] font-bold ring-1 ring-ink">Reset link</button>
          )}
        </section>
      ) : null}
      {chair ? <LinkReviewList chairIds={[chair.id]} className="mt-2" /> : null}
      {err ? <p className="mt-2 text-[13px] font-semibold">{err}</p> : null}
      {askReset && chair ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setAskReset(false)}>
          <div role="dialog" aria-label="Reset barber link" className="w-full max-w-[480px] rounded-t-[24px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-grey-200" />
            <b className="block text-[18px]">Reset {chairBarberName(chair)}’s link?</b>
            <ul className="mt-2 list-disc pl-5 text-[13.5px] font-semibold text-muted">
              <li>The current link stops working right away.</li>
              <li>Send the new link to {chairBarberName(chair)}.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAskReset(false)} className="h-11 rounded-pill text-[14px] font-bold ring-1 ring-ink">Cancel</button>
              <button type="button" data-auth="action" onClick={() => { const p = resetChairLink(chair.id); setErr(p ? "" : "Couldn’t reset the link."); setWasReset(Boolean(p)); setAskReset(false); }} className="h-11 rounded-pill bg-ink text-[14px] font-bold text-on-ink">Reset link</button>
            </div>
          </div>
        </div>
      ) : null}
      {ask && chair ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setAsk(false)}>
          <div role="dialog" aria-label="Deactivate barber" className="w-full max-w-[480px] rounded-t-[24px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-grey-200" />
            <b className="block text-[18px]">Deactivate {chairBarberName(chair)}?</b>
            <ul className="mt-2 list-disc pl-5 text-[13.5px] font-semibold text-muted">
              <li>Their barber link stops working right away.</li>
              <li>They’re hidden from rankings and can’t take walk-ins.</li>
              <li>Past sales and remit are kept. Turn them back on anytime here.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAsk(false)} className="h-11 rounded-pill text-[14px] font-bold ring-1 ring-ink">Cancel</button>
              <button type="button" data-auth="action" onClick={() => setActive(false)} className="h-11 rounded-pill bg-[#D92D20] text-[14px] font-bold text-white">Deactivate</button>
            </div>
          </div>
        </div>
      ) : null}
      <section className="mt-3 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
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
