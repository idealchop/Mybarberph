"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { CoinIcon } from "@river-apps/icons";
import { Avatar, Button, Card, IconTile, ListItem, SearchInput, SegmentedControl, Topbar } from "@river-apps/ui";
import { Stars } from "@/components/art";
import { Dialog } from "@/components/common/Dialog";
import { FilterSelect, PaymentPill, Pill } from "@/components/common/ui";
import { PageColumn } from "@/components/shell/PageColumn";
import type { Barber, Chair, DailySales, PaymentMethod, SalesSummary, Transaction } from "@/data";
import { clock, PAYMENT_LABEL, peso } from "@/lib/format";

export interface SalesData { summary: SalesSummary; transactions: Transaction[]; barbers: Barber[]; chairs: Chair[]; week: DailySales[]; month: DailySales[] }
type Range = "day" | "week" | "month";
const PAGE = 10;
const glow = <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />;

function Kpi({ label, value, caption, aside }: { label: string; value: string; caption: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between rounded-card bg-surface px-5 py-[18px] shadow-card">
      <div className="flex flex-col leading-[1.25]"><span className="text-[12px] font-semibold text-muted">{label}</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{value}</span><span className="mt-1 text-[12px] font-semibold text-muted">{caption}</span></div>
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
  const isFiltered = barberId !== "all" || chairId !== "all" || method !== "all" || !!q.trim();
  const tot = isFiltered
    ? { n: filtered.length, sales: filtered.reduce((a, x) => a + x.total, 0), tips: filtered.reduce((a, x) => a + (x.tip ?? 0), 0) }
    : { n: s.transactions, sales: s.sales, tips: s.tips };
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
    <PageColumn>
      <Topbar
        className="px-1"
        title="Sales"
        subtitle={`${s.dayLabel} · ${s.transactions} sales`}
        actions={<Button size="md" variant="secondary" leadingIcon={<Download size={18} strokeWidth={1.75} />} onClick={exportCsv}>Export CSV</Button>}
      />
      <SegmentedControl<Range> className="mt-4 w-fit" label="Period" value={range} onChange={setRange} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-card bg-ink px-4 pb-3.5 pt-4 text-on-ink shadow-raised">
          {glow}
          <div className="relative flex flex-col leading-[1.25]"><span className="text-[12px] font-semibold text-on-ink-muted">Sales {rangeLabel}</span><span className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">{peso(k(s.sales))}</span><span className="mt-1 text-[12px] font-semibold text-on-ink-muted">{s.salesDeltaLabel}</span></div>
        </div>
        <Kpi label="Tips" value={peso(k(s.tips))} caption={`${k(s.tippers)} tippers`} aside={<IconTile size={40} style={{ borderRadius: 12 }}><CoinIcon size={28} /></IconTile>} />
        <Kpi label="Transactions" value={String(k(s.transactions))} caption={`${k(s.walkIns)} walk-in · ${k(s.online)} online`} />
        <Kpi label="Avg ticket" value={peso(s.avgTicket)} caption={s.highestLabel} />
      </section>

      <SearchInput className="mt-4" placeholder="Search ticket or customer" label="Search sales" value={q} onChange={(e) => set(setQ)(e.target.value)} />

      <div className="mt-3 flex flex-wrap gap-2 px-1">
        <FilterSelect label="Barber" value={barberId} onChange={set(setBarberId)} options={[{ value: "all", label: "All barbers" }, ...data.barbers.map((b) => ({ value: b.id, label: b.nickname }))]} />
        <FilterSelect<"all" | PaymentMethod> label="Payment" value={method} onChange={set(setMethod)} options={[{ value: "all", label: "All payments" }, ...(["cash", "gcash", "maya", "card"] as const).map((m) => ({ value: m, label: PAYMENT_LABEL[m] }))]} />
      </div>

      <Card padding="none" className="mt-4 px-4 py-1.5">
        <ul aria-label="Transactions">
          {rows.map((x) => (
            <li key={x.id} className="border-b border-line last:border-b-0">
              <button type="button" className="block w-full text-left" onClick={() => setOpen(x)}>
                <ListItem
                  variant="row"
                  className="py-2.5"
                  leading={<Avatar name={x.customerName} preset={x.customerAvatar} size={40} />}
                  title={<>{x.customerName} <span className="ml-1 font-mono text-[12.5px] font-semibold text-muted">{x.referenceId}</span></>}
                  subtitle={`${clock(x.completedAt)} · ${x.serviceLabel} · ${barber(x.barberId)?.nickname ?? "—"} · ${PAYMENT_LABEL[x.paymentMethod]}`}
                  trailing={<span className="flex flex-col items-end leading-[1.3]"><b className="text-[14px] font-extrabold">{peso(x.total)}</b><small className="text-[12px] font-medium text-muted">{x.tip ? `+${peso(x.tip)} tip` : "no tip"}</small></span>}
                />
              </button>
            </li>
          ))}
          {!rows.length ? <li className="py-8 text-center text-[13.5px] font-semibold text-muted">No transactions match.</li> : null}
        </ul>
      </Card>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] font-semibold text-muted">
        <span>{tot.n} sales · <b className="text-ink">{peso(tot.sales)}</b> · tips <b className="text-ink">{peso(tot.tips)}</b></span>
        <span className="flex items-center gap-2">
          {filtered.length ? `${(cur - 1) * PAGE + 1}–${Math.min(cur * PAGE, filtered.length)}` : "0"} of {filtered.length}
          <button type="button" aria-label="Previous page" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-ink shadow-tile disabled:opacity-40"><ChevronLeft size={16} strokeWidth={1.75} /></button>
          <button type="button" aria-label="Next page" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-ink shadow-tile disabled:opacity-40"><ChevronRight size={16} strokeWidth={1.75} /></button>
        </span>
      </div>

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
    </PageColumn>
  );
}
