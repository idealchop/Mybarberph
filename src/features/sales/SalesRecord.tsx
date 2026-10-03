"use client";
import { useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { CoinIcon } from "@river-apps/icons";
import { Avatar, Button, cn, IconTile, SegmentedControl } from "@river-apps/ui";
import { Stars } from "@/components/art";
import { Dialog } from "@/components/common/Dialog";
import { FilterSelect, PaymentPill, Pill, Ref } from "@/components/common/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import type { Barber, Chair, DailySales, PaymentMethod, SalesSummary, Transaction } from "@/data";
import { clock, PAYMENT_LABEL, peso } from "@/lib/format";

export interface SalesData { summary: SalesSummary; transactions: Transaction[]; barbers: Barber[]; chairs: Chair[]; week: DailySales[]; month: DailySales[] }
type Range = "day" | "week" | "month";
const MIX_TONE: Record<PaymentMethod, string> = { cash: "bg-ink", gcash: "bg-grey-500", maya: "bg-grey-300", card: "bg-grey-200" };
const PAGE = 10;
const glow = <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />;

function Kpi({ label, value, caption, aside }: { label: string; value: string; caption: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between rounded-card bg-surface px-5 py-[18px] shadow-card">
      <div className="flex flex-col leading-tight"><span className="text-[12px] font-semibold text-muted">{label}</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{value}</span><span className="mt-1 text-[12px] font-semibold text-muted">{caption}</span></div>
      {aside}
    </div>
  );
}

export function SalesRecord({ data }: { data: SalesData }) {
  const s = data.summary;
  const [range, setRange] = useState<Range>("day");
  const [barberId, setBarberId] = useState("all");
  const [chairId, setChairId] = useState("all");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Transaction | null>(null);
  const barber = (id: string) => data.barbers.find((b) => b.id === id);
  const chair = (id: string) => data.chairs.find((c) => c.id === id);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.transactions.filter((x) => (barberId === "all" || x.barberId === barberId) && (chairId === "all" || x.chairId === chairId) &&
      (method === "all" || x.paymentMethod === method) && (!t || x.customerName.toLowerCase().includes(t) || x.referenceId.toLowerCase().includes(t)));
  }, [data.transactions, barberId, chairId, method, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const set = <V,>(fn: (v: V) => void) => (v: V) => { fn(v); setPage(1); };

  // Week / Month KPIs are scaled from the daily series (mock); Day uses the day summary.
  const factor = range === "day" ? 1 : (range === "week" ? data.week : data.month).reduce((a, d) => a + d.sales, 0) / s.sales;
  const k = (n: number) => Math.round(n * factor);
  const mixTotal = s.paymentMix.reduce((a, m) => a + m.amount, 0);
  const isFiltered = barberId !== "all" || chairId !== "all" || method !== "all" || !!q.trim();
  const tot = isFiltered
    ? { n: filtered.length, sales: filtered.reduce((a, x) => a + x.total, 0), tips: filtered.reduce((a, x) => a + (x.tip ?? 0), 0) }
    : { n: s.transactions, sales: s.sales, tips: s.tips };
  const rated = filtered.filter((x) => x.rating);
  const avgRating = isFiltered ? (rated.reduce((a, x) => a + (x.rating ?? 0), 0) / Math.max(1, rated.length)) : s.avgRating;
  const rangeLabel = range === "day" ? "today" : range === "week" ? "this week" : "this month";

  function exportCsv() {
    const head = ["Time", "Ticket", "Customer", "River Mobile", "Service", "Barber", "Chair", "Payment", "Subtotal", "Discount", "Amount", "Tip", "Rating"];
    const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((x) => [clock(x.completedAt), x.referenceId, x.customerName, x.fromRiverMobile ? "yes" : "no", x.serviceLabel, barber(x.barberId)?.nickname,
      chair(x.chairId)?.label, PAYMENT_LABEL[x.paymentMethod], x.subtotal / 100, (x.discount?.amount ?? 0) / 100, x.total / 100, (x.tip ?? 0) / 100, x.rating ?? ""].map(esc).join(","));
    const blob = new Blob([[head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kanto-kings-sales-2026-10-04.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader title="Sales record" subtitle={`${s.dayLabel} · ${s.transactions} transactions · shop closes ${s.closesAt}`} bell={false}
        actions={<>
          <SegmentedControl<Range> label="Period" value={range} onChange={setRange} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          <Button variant="secondary" className="hidden lg:inline-flex" leadingIcon={<Calendar size={18} strokeWidth={1.75} />} trailingIcon={<ChevronDown size={16} strokeWidth={1.75} />}>Sun, Oct 4</Button>
          <Button leadingIcon={<Download size={18} strokeWidth={1.75} />} onClick={exportCsv}>Export CSV</Button>
        </>} />

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.45fr]">
        <div className="relative overflow-hidden rounded-card bg-ink px-5 py-[18px] text-on-ink shadow-raised">
          {glow}
          <div className="relative flex flex-col leading-tight"><span className="text-[12px] font-semibold text-on-ink-muted">Sales {rangeLabel}</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{peso(k(s.sales))}</span><span className="mt-1 text-[12px] font-semibold text-on-ink-muted">{range === "day" ? s.salesDeltaLabel : range === "week" ? "+9% vs last week" : "+12% vs September"}</span></div>
        </div>
        <Kpi label="Tips (separate)" value={peso(k(s.tips))} caption={`${k(s.tippers)} of ${k(s.transactions)} tipped`} aside={<IconTile size={40} style={{ borderRadius: 12 }}><CoinIcon size={28} /></IconTile>} />
        <Kpi label="Transactions" value={String(k(s.transactions))} caption={`${k(s.walkIns)} walk-in · ${k(s.online)} online`} />
        <Kpi label="Avg ticket" value={peso(s.avgTicket)} caption={s.highestLabel} />
        <div className="flex flex-col rounded-card bg-surface px-5 py-[18px] shadow-card sm:col-span-2 xl:col-span-1">
          <div className="flex items-baseline justify-between"><span className="text-[12px] font-semibold text-muted">Payment mix</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted"><Stars value={5} size={11} /><b className="text-ink">{s.avgRating}</b> · {k(s.ratingsCount)} ratings</span></div>
          <div className="mt-3 flex h-3 gap-[3px] overflow-hidden rounded-pill" role="img" aria-label={s.paymentMix.map((m) => `${PAYMENT_LABEL[m.method]} ${peso(k(m.amount))}`).join(", ")}>
            {s.paymentMix.map((m) => <span key={m.method} className={cn("block", MIX_TONE[m.method])} style={{ width: `${(m.amount / mixTotal) * 100}%` }} />)}
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2 text-[12px] font-semibold leading-tight text-muted">
            {s.paymentMix.map((m) => <span key={m.method}><i className={cn("mr-1 inline-block size-[7px] rounded-full align-middle", MIX_TONE[m.method])} />{PAYMENT_LABEL[m.method]}<br /><b className="text-[13.5px] text-ink">{peso(k(m.amount))}</b></span>)}
          </div>
        </div>
      </section>

      <section className="mt-[18px] rounded-card bg-surface px-[18px] pb-3 pt-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col leading-tight"><span className="text-[16px] font-bold">Transactions</span><span className="mt-0.5 text-[12.5px] font-semibold text-muted">Newest first · tips shown apart from sales{range !== "day" ? " · showing today" : ""}</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Barber" value={barberId} onChange={set(setBarberId)} options={[{ value: "all", label: "All barbers" }, ...data.barbers.map((b) => ({ value: b.id, label: b.nickname }))]} />
            <FilterSelect label="Chair" value={chairId} onChange={set(setChairId)} options={[{ value: "all", label: "All chairs" }, ...data.chairs.map((c) => ({ value: c.id, label: c.label }))]} />
            <FilterSelect<"all" | PaymentMethod> label="Payment" value={method} onChange={set(setMethod)} options={[{ value: "all", label: "All payments" }, ...(["cash", "gcash", "maya", "card"] as const).map((m) => ({ value: m, label: PAYMENT_LABEL[m] }))]} />
            <label className="flex h-[34px] w-[220px] items-center gap-2 rounded-[12px] bg-canvas px-3 text-subtle focus-within:ring-2 focus-within:ring-ink">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span className="sr-only">Search ticket or customer</span>
              <input value={q} onChange={(e) => set(setQ)(e.target.value)} placeholder="Search ticket or customer" className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-subtle" />
            </label>
          </div>
        </div>
        <div className="-mx-1 mt-3 overflow-x-auto px-1">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead><tr className="text-[12px] text-muted">
              <th className="whitespace-nowrap pb-2 pl-1 pr-3 font-semibold">Time</th>
              {["Ticket", "Customer", "Service", "Barber", "Chair", "Payment"].map((h) => <th key={h} className="whitespace-nowrap pb-2 pr-3 font-semibold">{h}</th>)}
              <th className="whitespace-nowrap pb-2 pr-3 text-right font-semibold">Amount</th><th className="whitespace-nowrap pb-2 pr-4 text-right font-semibold">Tip</th><th className="whitespace-nowrap pb-2 pr-1 font-semibold">Feedback</th>
            </tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} onClick={() => setOpen(x)} className="cursor-pointer border-t border-line hover:bg-grey-50">
                  <td className="whitespace-nowrap py-[8px] pl-1 pr-3 text-[13px] font-semibold text-ink-2">{clock(x.completedAt)}</td>
                  <td className="whitespace-nowrap py-[8px] pr-3"><Ref>{x.referenceId}</Ref></td>
                  <td className="whitespace-nowrap py-[8px] pr-3"><span className="flex items-center gap-2.5"><Avatar name={x.customerName} preset={x.customerAvatar} size={28} /><b className="text-[14px] tracking-[-0.01em]">{x.customerName}</b>
                    {x.fromRiverMobile ? <span className="ml-1 inline-flex items-center rounded-pill bg-grey-100 px-2 py-[3px] align-middle text-[10.5px] font-bold leading-none">River Mobile</span> : null}</span></td>
                  <td className="whitespace-nowrap py-[8px] pr-3 text-[13.5px] font-semibold">{x.serviceLabel}</td>
                  <td className="whitespace-nowrap py-[8px] pr-3 text-[13.5px] font-bold">{barber(x.barberId)?.nickname}</td>
                  <td className="whitespace-nowrap py-[8px] pr-3 text-[13px] font-semibold text-muted">{chair(x.chairId)?.label}</td>
                  <td className="whitespace-nowrap py-[8px] pr-3"><PaymentPill method={x.paymentMethod} /></td>
                  <td className="whitespace-nowrap py-[8px] pr-3 text-right text-[14px] font-extrabold">{peso(x.total)}</td>
                  <td className="whitespace-nowrap py-[8px] pr-4 text-right">{x.tip ? <span className="text-[13.5px] font-bold text-ink-2">+{peso(x.tip)}</span> : <span className="text-[13.5px] font-semibold text-subtle">—</span>}</td>
                  <td className="whitespace-nowrap py-[8px] pr-1">{x.rating ? <Stars value={x.rating} /> : <span className="text-[12.5px] font-semibold text-subtle">No rating</span>}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={10} className="border-t border-line py-8 text-center text-[13.5px] font-semibold text-muted">No transactions match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-grey-100 px-4 py-3">
          <span className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] font-semibold text-muted">
            <b className="text-[14px] text-ink">{isFiltered ? "Filtered totals" : "Daily totals"}</b>
            <span>{tot.n} transactions</span>
            <span>Sales <b className="text-[14px] font-extrabold text-ink">{peso(tot.sales)}</b></span>
            <span>Tips <b className="text-[14px] font-extrabold text-ink">{peso(tot.tips)}</b></span>
            <span>Total collected <b className="text-[14px] font-extrabold text-ink">{peso(tot.sales + tot.tips)}</b></span>
            <span>Avg rating <b className="text-[14px] font-extrabold text-ink">{avgRating.toFixed(1)}</b></span>
          </span>
          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
            {filtered.length ? `${(cur - 1) * PAGE + 1}–${Math.min(cur * PAGE, filtered.length)}` : "0"} of {filtered.length}
            <button type="button" aria-label="Previous page" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-ink shadow-tile disabled:opacity-40"><ChevronLeft size={16} strokeWidth={1.75} /></button>
            <button type="button" aria-label="Next page" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-ink shadow-tile disabled:opacity-40"><ChevronRight size={16} strokeWidth={1.75} /></button>
          </span>
        </div>
      </section>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${open.referenceId} · ${open.customerName}` : ""} subtitle={open ? `${clock(open.completedAt)} · ${barber(open.barberId)?.nickname} · ${chair(open.chairId)?.label}` : undefined}>
        {open ? (
          <div className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2 rounded-[18px] bg-grey-100 p-4 text-[14px] font-semibold">
              <div className="flex justify-between"><dt className="text-muted">{open.serviceLabel}</dt><dd>{peso(open.subtotal)}</dd></div>
              {open.discount ? <div className="flex justify-between"><dt className="text-muted">{open.discount.label}</dt><dd>−{peso(open.discount.amount)}</dd></div> : null}
              <div className="flex justify-between border-t border-grey-200 pt-2"><dt>Sale</dt><dd className="font-extrabold">{peso(open.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tip (to {barber(open.barberId)?.nickname}, not in sales)</dt><dd>{open.tip ? peso(open.tip) : "—"}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center gap-2"><PaymentPill method={open.paymentMethod} />{open.fromRiverMobile ? <Pill>River Mobile · verified</Pill> : <Pill>Walk-in</Pill>}
              {open.rating ? <span className="ml-auto"><Stars value={open.rating} size={15} /></span> : <span className="ml-auto text-[12.5px] font-semibold text-subtle">No rating</span>}</div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
