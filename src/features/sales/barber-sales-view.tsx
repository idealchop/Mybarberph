"use client";
import { Sk } from "@/components/common/skeleton";
import { Card, EmptyState, Input, SegmentedControl } from "@river-apps/ui";
import { useEffect, useState } from "react";
import type { BarberSales, BarberSalesRow } from "@/lib/barber-sales";
import { api } from "@/lib/cloud";
import { peso } from "@/lib/format";

type Range = "week" | "month" | "custom";
const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/** Per barber: cuts, sales, cash vs GCash, and the cash each must hand over (remit). For salary and remittance. */
export function BarberSalesView({ loc, ranked }: { loc: string; ranked?: boolean }) {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState(() => today().slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [got, setGot] = useState<{ key: string; d: BarberSales } | null>(null);
  const key = `${range}|${loc}|${range === "custom" ? `${from}|${to}` : ""}`;
  const data = got?.key === key ? got.d : null;
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ range, loc, ...(range === "custom" ? { from, to } : {}) });
    let retry = 0;
    const get = () => void api(`/api/shop/barber-sales?${qs}`).then((d: BarberSales) => { if (live) { setGot({ key: `${range}|${loc}|${range === "custom" ? `${from}|${to}` : ""}`, d }); setErr(""); } })
      .catch((e: Error) => { if (!live) return; if (retry++ < 2) window.setTimeout(get, 1200); else setErr(e.message); });
    get();
    return () => { live = false; };
  }, [range, from, to, loc]);
  return (
    <section aria-label="Sales by barber">
      <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">{ranked ? "Barber ranking · all locations" : "Barbers · pay & remit"}</h2>
      <SegmentedControl className="mt-2 w-fit" label="Period" value={range} onChange={(v: string) => setRange(v as Range)}
        options={[{ value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "custom", label: "Dates" }]} />
      {range === "custom" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      ) : null}
      <p className="mt-3 px-1 text-[13px] font-semibold text-muted">{data?.label ?? ""}{range === "week" ? " · Mon–Sun" : ""} · Manila time</p>
      {err ? <p className="mt-3 text-[13.5px] font-semibold">{err}</p> : null}
      {!data && !err ? <div role="status" aria-label="Loading" className="mt-3 flex flex-col gap-3">{[0, 1, 2].map((i) => <Sk key={i} className="h-24 w-full rounded-card" />)}</div> : null}
      {data && !data.barbers.length ? <EmptyState className="mt-4" title="No finished cuts" description="Cuts completed in this period show here per barber." /> : null}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {[...(data?.barbers ?? [])].sort((a, b) => b.gross - a.gross).map((b, i) => <BarberCard key={b.barberId} b={b} rank={ranked ? i + 1 : undefined} />)}
      </div>
      {data && data.barbers.length > 1 ? <div className="mt-3"><BarberCard b={data.total} total /></div> : null}
      <p className="mt-3 px-1 text-[12.5px] font-semibold text-muted">Remit is the cash the barber collected and hands to the shop. GCash goes straight to the shop.</p>
    </section>
  );
}

function BarberCard({ b, total, rank }: { b: BarberSalesRow; total?: boolean; rank?: number }) {
  return (
    <Card className={`px-4 py-3.5 ${total ? "bg-grey-100" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {rank ? <span className={`inline-flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${rank === 1 ? "bg-ink text-on-ink" : "bg-grey-100"}`}>{rank}</span> : null}
          <b className="truncate text-[16px]">{b.barberName}</b>
        </span>
        <span className="text-[13px] font-semibold text-muted">{b.cuts} cut{b.cuts === 1 ? "" : "s"}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]">
        <dt className="font-semibold text-muted">Sales</dt><dd className="text-right font-bold">{peso(b.gross)}</dd>
        <dt className="font-semibold text-muted">Cash</dt><dd className="text-right font-bold">{peso(b.cash)}</dd>
        <dt className="font-semibold text-muted">GCash</dt><dd className="text-right font-bold">{peso(b.gcash)}</dd>
        {b.online ? <><dt className="font-semibold text-muted">Online</dt><dd className="text-right font-bold">{peso(b.online)}</dd></> : null}
        {b.unpaid ? <><dt className="font-semibold text-muted">Unpaid</dt><dd className="text-right font-bold">{peso(b.unpaid)}</dd></> : null}
      </dl>
      <div className="mt-2.5 flex items-baseline justify-between border-t border-dashed border-[#E8E8EC] pt-2.5">
        <b className="text-[14px]">Remit (cash)</b>
        <b className="text-[19px] font-extrabold tracking-[-0.02em]">{peso(b.remit)}</b>
      </div>
    </Card>
  );
}
